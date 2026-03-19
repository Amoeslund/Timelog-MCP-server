import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetLegalEntities(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_legal_entities",
    {
      description: "Get all legal entities in the Timelog organization. Returns ID, name, active status, currency, and country for each entity.",
      inputSchema: z.object({}),
    },
    async () => {
      const data = await client.get("/v1/legal-entity");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
