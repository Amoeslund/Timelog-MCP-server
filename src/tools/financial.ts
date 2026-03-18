import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetFinancialData(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_financial_data",
    {
      description: "Get financial data (billable/invoice status) for time registrations in a date range.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date YYYY-MM-DD"),
        endDate: z.string().describe("End date YYYY-MM-DD"),
      }),
    },
    async ({ startDate, endDate }) => {
      const data = await client.get("/v1/time-registration-financial-data/get-by-date-range", {
        startDate,
        endDate,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
