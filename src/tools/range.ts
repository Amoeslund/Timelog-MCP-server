import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetRegistrationsByDateRange(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_registrations_by_date_range",
    {
      description: "Get time registrations between two dates.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date YYYY-MM-DD"),
        endDate: z.string().describe("End date YYYY-MM-DD"),
      }),
    },
    async ({ startDate, endDate }) => {
      const data = await client.get("/v1/time-tracking-item/get-by-date", {
        startDate,
        endDate,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
