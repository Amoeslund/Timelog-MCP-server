import { createHash, timingSafeEqual } from "node:crypto";
import express, { type RequestHandler, type Response, type Router } from "express";
import type { Sealer } from "./sealer.js";

export interface OAuthDeps {
  sealer: Sealer;
  publicBaseUrl: string;
  accessTokenTtlDays: number;
  allowedRedirectHosts: string[];
  /** Resolves to true when Timelog accepts the PAT. */
  validatePat: (pat: string) => Promise<boolean>;
}

interface RegisteredClient {
  redirectUris: string[];
}

interface PendingAuthorization {
  clientId: string;
  redirectUri: string;
  state?: string;
  codeChallenge: string;
}

interface IssuedCode {
  pat: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}

export interface AccessGrant {
  pat: string;
}

const TEN_MINUTES = 10 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

/**
 * OAuth 2.1 authorization server in front of Timelog.
 *
 * Timelog authenticates API calls with a personal access token, and MCP clients (claude.ai
 * connectors, Claude Code) authenticate with OAuth. This bridges the two: /authorize shows a
 * page where the user pastes their PAT once, and the access token the client receives is that
 * PAT sealed with the server's key. The PAT never reaches the client in the clear and is never
 * stored on the server.
 */
export function createOAuthRouter(deps: OAuthDeps): Router {
  const router = express.Router();
  const accessTtlMs = deps.accessTokenTtlDays * DAY;
  // Codes are sealed, so the server needs no record of them to redeem one. This set only makes
  // redemption single-use, as OAuth requires; a code replayed after a restart still needs the
  // PKCE verifier only the original client holds.
  const redeemedCodes = new Map<string, number>();

  router.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // RFC 9728 protected-resource metadata, at the bare path and at the path suffixed with the
  // resource's own path, which is where spec-following clients look first.
  const protectedResource =
    (resource: string): RequestHandler =>
    (_req, res) => {
      res.json({
        resource,
        authorization_servers: [deps.publicBaseUrl],
        bearer_methods_supported: ["header"],
      });
    };
  router.get("/.well-known/oauth-protected-resource", protectedResource(deps.publicBaseUrl));
  router.get(
    "/.well-known/oauth-protected-resource/mcp",
    protectedResource(`${deps.publicBaseUrl}/mcp`),
  );

  router.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.json({
      issuer: deps.publicBaseUrl,
      authorization_endpoint: `${deps.publicBaseUrl}/authorize`,
      token_endpoint: `${deps.publicBaseUrl}/token`,
      registration_endpoint: `${deps.publicBaseUrl}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    });
  });

  // Dynamic client registration. The client id is the registration itself, sealed, so there is
  // no registry to persist and nothing for a loop over this endpoint to fill up.
  router.post("/register", (req, res) => {
    const uris = (req.body as { redirect_uris?: unknown }).redirect_uris;
    if (
      !Array.isArray(uris) ||
      uris.length === 0 ||
      !uris.every((uri): uri is string => typeof uri === "string" && isAllowedRedirect(uri, deps))
    ) {
      res.status(400).json({
        error: "invalid_redirect_uri",
        error_description: `redirect_uris must be https URLs on: ${deps.allowedRedirectHosts.join(", ")}`,
      });
      return;
    }
    const client: RegisteredClient = { redirectUris: uris };
    res.status(201).json({
      client_id: deps.sealer.seal("client", client),
      redirect_uris: uris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
    });
  });

  router.get("/authorize", (req, res) => {
    const clientId = asString(req.query.client_id);
    const redirectUri = asString(req.query.redirect_uri);
    const challenge = asString(req.query.code_challenge);
    const client = clientId === undefined ? null : deps.sealer.open<RegisteredClient>("client", clientId);

    // Errors render here and never redirect: until redirect_uri is validated, redirecting would
    // hand an attacker-chosen endpoint the very hop this check refuses.
    if (
      clientId === undefined ||
      client === null ||
      redirectUri === undefined ||
      !client.redirectUris.includes(redirectUri)
    ) {
      res.status(400).json({
        error: "invalid_request",
        error_description: "client_id is not registered for the given redirect_uri.",
      });
      return;
    }
    if (req.query.response_type !== "code" || challenge === undefined || req.query.code_challenge_method !== "S256") {
      res.status(400).json({
        error: "invalid_request",
        error_description: "response_type=code, code_challenge and code_challenge_method=S256 are required.",
      });
      return;
    }

    const pending: PendingAuthorization = {
      clientId,
      redirectUri,
      codeChallenge: challenge,
      ...(typeof req.query.state === "string" ? { state: req.query.state } : {}),
    };
    renderPatForm(res, 200, deps.sealer.seal("request", pending, TEN_MINUTES), redirectUri);
  });

  router.post("/authorize", async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const request = asString(body.request);
    const pat = asString(body.pat)?.trim();
    const pending = request === undefined ? null : deps.sealer.open<PendingAuthorization>("request", request);

    if (request === undefined || pending === null) {
      res.status(400).type("text/plain").send("The sign-in request expired. Start again from your MCP client.");
      return;
    }
    if (!pat) {
      renderPatForm(res, 400, request, pending.redirectUri, "Paste your personal access token.");
      return;
    }

    let valid: boolean;
    try {
      valid = await deps.validatePat(pat);
    } catch {
      renderPatForm(res, 502, request, pending.redirectUri, "Timelog could not be reached. Try again.");
      return;
    }
    if (!valid) {
      renderPatForm(res, 400, request, pending.redirectUri, "Timelog rejected that token. Check it and try again.");
      return;
    }

    const code: IssuedCode = {
      pat,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      codeChallenge: pending.codeChallenge,
    };
    const target = new URL(pending.redirectUri);
    target.searchParams.set("code", deps.sealer.seal("code", code, TEN_MINUTES));
    if (pending.state !== undefined) target.searchParams.set("state", pending.state);
    res.redirect(302, target.toString());
  });

  router.post("/token", (req, res) => {
    const body = req.body as Record<string, unknown>;
    const code = asString(body.code);
    const verifier = asString(body.code_verifier);
    const record = code === undefined ? null : deps.sealer.open<IssuedCode & { exp: number }>("code", code);

    if (body.grant_type !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }
    if (code === undefined || verifier === undefined || record === null) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    const now = Date.now();
    for (const [key, exp] of redeemedCodes) if (exp < now) redeemedCodes.delete(key);
    const codeKey = createHash("sha256").update(code).digest("base64url");
    if (redeemedCodes.has(codeKey)) {
      res.status(400).json({ error: "invalid_grant", error_description: "code already used" });
      return;
    }

    // The code must be redeemed by the client, at the redirect_uri, it was issued for.
    if (body.client_id !== record.clientId || body.redirect_uri !== record.redirectUri) {
      res.status(400).json({
        error: "invalid_grant",
        error_description: "client_id or redirect_uri does not match the authorization request.",
      });
      return;
    }
    if (!verifierMatches(verifier, record.codeChallenge)) {
      res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
      return;
    }
    redeemedCodes.set(codeKey, record.exp);

    const grant: AccessGrant = { pat: record.pat };
    res.set("Cache-Control", "no-store").json({
      access_token: deps.sealer.seal("access", grant, accessTtlMs),
      token_type: "Bearer",
      expires_in: Math.floor(accessTtlMs / 1000),
    });
  });

  return router;
}

/** Puts the caller's PAT on res.locals.pat, or answers 401 with the discovery challenge. */
export function requireAccess(sealer: Sealer, publicBaseUrl: string): RequestHandler {
  return (req, res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const grant = token === null ? null : sealer.open<AccessGrant>("access", token);
    if (grant === null) {
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `Bearer resource_metadata="${publicBaseUrl}/.well-known/oauth-protected-resource/mcp"`,
        )
        .json({ error: "unauthorized" });
      return;
    }
    res.locals.pat = grant.pat;
    next();
  };
}

// https for every allowed host; plain http only for loopback, where Claude Code's local
// callback listens.
function isAllowedRedirect(uri: string, deps: OAuthDeps): boolean {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const loopback = host === "localhost" || host === "127.0.0.1";
  if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) return false;
  return deps.allowedRedirectHosts.includes(host);
}

function renderPatForm(res: Response, status: number, request: string, redirectUri: string, error?: string) {
  const host = new URL(redirectUri).host;
  res
    .status(status)
    // The page collects a credential: never framed, never cached, no script.
    .set({
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    })
    .type("html")
    .send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect Timelog</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1a1a1a; }
  input[type=password] { width: 100%; padding: .6rem; font-size: 1rem; box-sizing: border-box; }
  button { margin-top: 1rem; padding: .6rem 1.2rem; font-size: 1rem; }
  .error { color: #b00020; }
  .muted { color: #555; font-size: .9rem; }
</style>
</head>
<body>
<h1>Connect Timelog</h1>
<p><strong>${escapeHtml(host)}</strong> is asking to read and write your Timelog time registrations.</p>
<p>Paste a Timelog personal access token. Create one at
<a href="https://login.timelog.com/personaltoken" target="_blank" rel="noopener">login.timelog.com/personaltoken</a>.</p>
${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
<form method="post" action="authorize">
  <input type="hidden" name="request" value="${escapeHtml(request)}">
  <label for="pat">Personal access token</label>
  <input type="password" id="pat" name="pat" autocomplete="off" required autofocus>
  <button type="submit">Connect</button>
</form>
<p class="muted">The token is encrypted into the credential your client keeps. This server does not store it.
Revoke the token in Timelog to disconnect.</p>
</body>
</html>`);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function verifierMatches(verifier: string, challenge: string): boolean {
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}
