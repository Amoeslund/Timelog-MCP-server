import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetCurrentUser(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_current_user",
    {
      description: "Get the currently authenticated Timelog user (name, email, department).",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await client.get("/v1/user/me");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
