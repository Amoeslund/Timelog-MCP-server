#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TimelogClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  process.stderr.write(
    `[timelog-mcp] Requires Node.js 18+. Running: ${process.version}\n` +
      `Fix: set nvm default with 'nvm alias default 22'\n`,
  );
  process.exit(1);
}

const config = loadConfig();
const client = new TimelogClient(config);

const server = new McpServer({
  name: "timelog",
  version: "1.0.0",
});

registerAllTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
