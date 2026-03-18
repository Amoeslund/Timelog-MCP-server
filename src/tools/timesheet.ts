import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetTimesheetStatus(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_timesheet_status",
    {
      description: "Get approval/submission status of timesheets for a date range.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date YYYY-MM-DD"),
        endDate: z.string().describe("End date YYYY-MM-DD"),
      }),
    },
    async ({ startDate, endDate }) => {
      const data = await client.get("/v1/approval/timesheets/get-status-by-dates", {
        startDate,
        endDate,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
