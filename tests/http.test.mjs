import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../dist/http/app.js";
import { Sealer } from "../dist/http/sealer.js";
import { loadHttpConfig } from "../dist/http/config.js";

const GOOD_PAT = "good-pat";
const REDIRECT = "https://claude.ai/api/mcp/auth_callback";
const realFetch = globalThis.fetch;

async function startServer(overrides = {}) {
  const sealer = new Sealer(randomBytes(32));
  const app = createApp({
    sealer,
    publicBaseUrl: "http://placeholder",
    timelogBaseUrl: "https://timelog.example/api",
    accessTokenTtlDays: 30,
    allowedRedirectHosts: ["claude.ai", "localhost", "127.0.0.1"],
    validatePat: async (pat) => pat === GOOD_PAT,
    ...overrides,
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, sealer, close: () => new Promise((r) => server.close(r)) };
}

function pkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

async function register(base, redirectUris = [REDIRECT]) {
  const res = await realFetch(`${base}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: redirectUris }),
  });
  return { res, body: await res.json() };
}

async function authorize(base, clientId, challenge, pat = GOOD_PAT) {
  const url = new URL(`${base}/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "xyz",
  }).toString();
  const page = await realFetch(url);
  assert.equal(page.status, 200);
  const html = await page.text();
  const request = html.match(/name="request" value="([^"]+)"/)[1];
  return realFetch(`${base}/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ request, pat }).toString(),
  });
}

async function token(base, params) {
  return realFetch(`${base}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", redirect_uri: REDIRECT, ...params }).toString(),
  });
}

async function fullFlow(base) {
  const { body: client } = await register(base);
  const { verifier, challenge } = pkce();
  const redirect = await authorize(base, client.client_id, challenge);
  const code = new URL(redirect.headers.get("location")).searchParams.get("code");
  const res = await token(base, { code, code_verifier: verifier, client_id: client.client_id });
  return (await res.json()).access_token;
}

function mcp(base, accessToken, body) {
  return realFetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function rpcResult(res) {
  const text = await res.text();
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data ? data.slice(6) : text);
}

test("sealer round-trips, binds purpose and expires", () => {
  const sealer = new Sealer(randomBytes(32));
  const value = sealer.seal("access", { pat: "x" }, 60_000);
  assert.equal(sealer.open("access", value).pat, "x");
  assert.equal(sealer.open("client", value), null);
  assert.equal(sealer.open("access", value.slice(0, -2) + "AA"), null);
  assert.equal(sealer.open("access", sealer.seal("access", { pat: "x" }, -1)), null);
  assert.equal(new Sealer(randomBytes(32)).open("access", value), null);
});

test("loadHttpConfig requires its variables and applies defaults", () => {
  assert.throws(() => loadHttpConfig({}), /TIMELOG_BASE_URL|PUBLIC_BASE_URL/);
  const cfg = loadHttpConfig({
    TIMELOG_BASE_URL: "https://app1.timelog.com/acme/api/",
    PUBLIC_BASE_URL: "https://mcp.example.com/",
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  });
  assert.equal(cfg.timelogBaseUrl, "https://app1.timelog.com/acme/api");
  assert.equal(cfg.publicBaseUrl, "https://mcp.example.com");
  assert.equal(cfg.port, 8080);
  assert.equal(cfg.accessTokenTtlDays, 30);
  assert.ok(cfg.allowedRedirectHosts.includes("claude.ai"));
});

test("unauthenticated /mcp answers 401 with the discovery challenge", async () => {
  const { base, close } = await startServer();
  try {
    const res = await mcp(base, null, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(res.status, 401);
    assert.match(res.headers.get("www-authenticate"), /oauth-protected-resource\/mcp/);
    const meta = await (await realFetch(`${base}/.well-known/oauth-authorization-server`)).json();
    assert.equal(meta.registration_endpoint, "http://placeholder/register");
  } finally {
    await close();
  }
});

test("register refuses redirect hosts outside the allowlist", async () => {
  const { base, close } = await startServer();
  try {
    assert.equal((await register(base, ["https://evil.example/cb"])).res.status, 400);
    assert.equal((await register(base, ["http://claude.ai/cb"])).res.status, 400);
    assert.equal((await register(base, ["http://localhost:3333/callback"])).res.status, 201);
  } finally {
    await close();
  }
});

test("a rejected PAT re-renders the form instead of issuing a code", async () => {
  const { base, close } = await startServer();
  try {
    const { body: client } = await register(base);
    const res = await authorize(base, client.client_id, pkce().challenge, "bad-pat");
    assert.equal(res.status, 400);
    assert.match(await res.text(), /rejected that token/);
  } finally {
    await close();
  }
});

test("full flow: PAT -> code -> token -> tool call with that PAT", async () => {
  const { base, close } = await startServer();
  try {
    const { body: client } = await register(base);
    const { verifier, challenge } = pkce();
    const redirect = await authorize(base, client.client_id, challenge);
    assert.equal(redirect.status, 302);
    const location = new URL(redirect.headers.get("location"));
    assert.equal(location.origin + location.pathname, REDIRECT);
    assert.equal(location.searchParams.get("state"), "xyz");
    const code = location.searchParams.get("code");

    assert.equal((await token(base, { code, code_verifier: "wrong", client_id: client.client_id })).status, 400);
    const res = await token(base, { code, code_verifier: verifier, client_id: client.client_id });
    assert.equal(res.status, 200);
    const { access_token } = await res.json();
    assert.ok(!access_token.includes(GOOD_PAT));
    assert.equal(
      (await token(base, { code, code_verifier: verifier, client_id: client.client_id })).status,
      400,
      "codes are single-use",
    );

    const list = await rpcResult(await mcp(base, access_token, { jsonrpc: "2.0", id: 1, method: "tools/list" }));
    assert.ok(list.result.tools.some((t) => t.name === "get_current_user"));

    const timelogCalls = [];
    globalThis.fetch = async (url, opts) => {
      if (new URL(String(url)).host === "timelog.example") {
        timelogCalls.push({ url: String(url), auth: opts.headers.Authorization });
        return new Response(JSON.stringify({ Name: "Ada" }), { status: 200 });
      }
      return realFetch(url, opts);
    };
    try {
      const call = await rpcResult(
        await mcp(base, access_token, {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "get_current_user", arguments: {} },
        }),
      );
      assert.match(call.result.content[0].text, /Ada/);
    } finally {
      globalThis.fetch = realFetch;
    }
    assert.deepEqual(timelogCalls, [{ url: "https://timelog.example/api/v1/user/me", auth: `Bearer ${GOOD_PAT}` }]);
  } finally {
    await close();
  }
});

test("an access token from another key is refused", async () => {
  const a = await startServer();
  const b = await startServer();
  try {
    const accessToken = await fullFlow(a.base);
    const res = await mcp(b.base, accessToken, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    assert.equal(res.status, 401);
  } finally {
    await a.close();
    await b.close();
  }
});
