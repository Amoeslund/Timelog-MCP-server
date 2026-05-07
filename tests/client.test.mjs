import test from "node:test";
import assert from "node:assert/strict";
import { TimelogClient } from "../dist/client.js";

const baseUrl = "https://api.example.com";
const pat = "tok";

function mockFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, opts) => {
    const entry = { url: url.toString(), opts };
    calls.push(entry);
    return handler(entry);
  };
  return calls;
}

test("get builds URL with single param and parses JSON", async () => {
  const calls = mockFetch(
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  const client = new TimelogClient({ pat, baseUrl });
  const result = await client.get("/users", { id: "42" });
  assert.equal(calls[0].url, `${baseUrl}/users?id=42`);
  assert.deepEqual(result, { ok: true });
});

test("get appends repeated query params for array values", async () => {
  const calls = mockFetch(() => new Response("{}", { status: 200 }));
  const client = new TimelogClient({ pat, baseUrl });
  await client.get("/x", { tag: ["a", "b"] });
  const url = new URL(calls[0].url);
  assert.deepEqual(url.searchParams.getAll("tag"), ["a", "b"]);
});

test("get sends Authorization header with the configured PAT", async () => {
  const calls = mockFetch(() => new Response("{}", { status: 200 }));
  const client = new TimelogClient({ pat: "sekret", baseUrl });
  await client.get("/x");
  assert.equal(calls[0].opts.headers.Authorization, "Bearer sekret");
});

test("get throws with status and body on non-OK response", async () => {
  mockFetch(() => new Response("boom", { status: 500 }));
  const client = new TimelogClient({ pat, baseUrl });
  await assert.rejects(client.get("/x"), /Timelog API 500: boom/);
});

test("post sends JSON body and returns parsed response", async () => {
  const calls = mockFetch(
    () => new Response(JSON.stringify({ id: 1 }), { status: 200 }),
  );
  const client = new TimelogClient({ pat, baseUrl });
  const result = await client.post("/items", { name: "x" });
  assert.equal(calls[0].opts.method, "POST");
  assert.equal(calls[0].opts.headers["Content-Type"], "application/json");
  assert.equal(calls[0].opts.body, JSON.stringify({ name: "x" }));
  assert.deepEqual(result, { id: 1 });
});

test("post returns empty object when response body is empty", async () => {
  mockFetch(() => new Response("", { status: 200 }));
  const client = new TimelogClient({ pat, baseUrl });
  const result = await client.post("/items", {});
  assert.deepEqual(result, {});
});

test("put sends JSON body via PUT", async () => {
  const calls = mockFetch(
    () => new Response(JSON.stringify({ ok: 1 }), { status: 200 }),
  );
  const client = new TimelogClient({ pat, baseUrl });
  await client.put("/items/1", { name: "y" });
  assert.equal(calls[0].opts.method, "PUT");
  assert.equal(calls[0].opts.body, JSON.stringify({ name: "y" }));
});

test("delete throws with status and body on non-OK response", async () => {
  mockFetch(() => new Response("not found", { status: 404 }));
  const client = new TimelogClient({ pat, baseUrl });
  await assert.rejects(client.delete("/x/1"), /Timelog API 404: not found/);
});
