import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { TimelogClient } from "../client.js";
import { registerAllTools } from "../tools/index.js";
import { createOAuthRouter, requireAccess, type OAuthDeps } from "./oauth.js";

export interface AppDeps extends OAuthDeps {
  timelogBaseUrl: string;
  trustedProxyHops?: number;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  if (deps.trustedProxyHops) app.set("trust proxy", deps.trustedProxyHops);

  // Declared ahead of the shared body parsers so an unauthenticated caller is refused before
  // its body is read.
  app.post(
    "/mcp",
    requireAccess(deps.sealer, deps.publicBaseUrl),
    express.json({ limit: "1mb" }),
    async (req, res) => {
      // One server per request, bound to the caller's own PAT: Timelog's permissions and audit
      // trail apply to that person, and nothing is shared between users.
      const client = new TimelogClient({ pat: res.locals.pat as string, baseUrl: deps.timelogBaseUrl });
      const server = new McpServer({ name: "timelog", version: "1.0.0" });
      registerAllTools(server, client);

      // Stateless mode: no MCP session id. Authentication is the bearer token on every call.
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    },
  );

  // Streamable HTTP clients probe GET (SSE) and DELETE (session teardown). This server is
  // stateless and POST-only; a JSON 405 says so instead of an HTML 404.
  app.all("/mcp", (_req, res) => {
    res.status(405).set("Allow", "POST").json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "This MCP endpoint accepts POST only." },
      id: null,
    });
  });

  // /token is form-encoded (RFC 6749), /register is JSON, the PAT form posts form-encoded.
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, _res, next) => {
    if (req.body === undefined) req.body = {};
    next();
  });
  app.use(createOAuthRouter(deps));

  // Never echo the error: a request body here may carry a PAT.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = statusOf(error) ?? 500;
    console.error(JSON.stringify({ level: "error", status, message: (error as Error).message }));
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(status).json({ error: status === 500 ? "server_error" : "invalid_request" });
  });

  return app;
}

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 600 ? status : null;
}
