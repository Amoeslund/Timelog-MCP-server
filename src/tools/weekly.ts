import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetWeeklyRegistrations(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_weekly_registrations",
    {
      description: "Get time registrations for a specific week. Provide the Monday date of the week.",
      inputSchema: z.object({
        startDate: z.string().describe("Monday of the week, format YYYY-MM-DD"),
      }),
    },
    async ({ startDate }) => {
      const data = await client.get("/v1/time-tracking-item/get-weekly-registrations", {
        startDate,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
