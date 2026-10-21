#!/usr/bin/env node
// Hosted entry point: Streamable HTTP with OAuth, for Azure App Service. The stdio entry point
// for local installs is index.ts.
import { TimelogClient } from "./client.js";
import { createApp } from "./http/app.js";
import { loadHttpConfig } from "./http/config.js";
import { Sealer } from "./http/sealer.js";

const config = loadHttpConfig();

const app = createApp({
  sealer: Sealer.fromBase64(config.tokenEncryptionKey),
  publicBaseUrl: config.publicBaseUrl,
  timelogBaseUrl: config.timelogBaseUrl,
  accessTokenTtlDays: config.accessTokenTtlDays,
  allowedRedirectHosts: config.allowedRedirectHosts,
  trustedProxyHops: config.trustedProxyHops,
  validatePat: async (pat) => {
    try {
      await new TimelogClient({ pat, baseUrl: config.timelogBaseUrl }).get("/v1/user/me");
      return true;
    } catch (error) {
      // 401/403 is a bad token; anything else is Timelog being unreachable.
      if (/Timelog API 40[13]/.test((error as Error).message)) return false;
      throw error;
    }
  },
});

app.listen(config.port, () => {
  console.log(
    JSON.stringify({
      level: "info",
      message: "Timelog MCP server listening",
      port: config.port,
      publicBaseUrl: config.publicBaseUrl,
    }),
  );
});
