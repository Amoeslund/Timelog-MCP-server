import test from "node:test";
import assert from "node:assert/strict";

const ENV_VARS = ["TIMELOG_PAT", "TIMELOG_BASE_URL"];

function withEnv(env, fn) {
  const saved = {};
  for (const v of ENV_VARS) saved[v] = process.env[v];
  try {
    for (const v of ENV_VARS) delete process.env[v];
    Object.assign(process.env, env);
    return fn();
  } finally {
    for (const v of ENV_VARS) {
      if (saved[v] === undefined) delete process.env[v];
      else process.env[v] = saved[v];
    }
  }
}

test("loadConfig returns config when both env vars set", async () => {
  const { loadConfig } = await import("../dist/config.js");
  withEnv(
    { TIMELOG_PAT: "tok", TIMELOG_BASE_URL: "https://api.example.com" },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.pat, "tok");
      assert.equal(cfg.baseUrl, "https://api.example.com");
    },
  );
});

test("loadConfig throws when TIMELOG_PAT is missing", async () => {
  const { loadConfig } = await import("../dist/config.js");
  withEnv({ TIMELOG_BASE_URL: "https://api.example.com" }, () => {
    assert.throws(() => loadConfig(), /TIMELOG_PAT/);
  });
});

test("loadConfig throws when TIMELOG_BASE_URL is missing", async () => {
  const { loadConfig } = await import("../dist/config.js");
  withEnv({ TIMELOG_PAT: "tok" }, () => {
    assert.throws(() => loadConfig(), /TIMELOG_BASE_URL/);
  });
});
