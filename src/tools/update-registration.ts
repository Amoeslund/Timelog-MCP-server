import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerUpdateTimeRegistration(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "update_time_registration",
    {
      description: "Update an existing time registration (hours, comment, date, billable status).",
      inputSchema: z.object({
        TimeRegistrationID: z.number().int().describe("Time registration ID to update"),
        TaskID: z.number().int().describe("Task identifier"),
        Date: z.string().optional().describe("New date, format YYYY-MM-DD"),
        Hours: z.number().optional().describe("New hours value"),
        Comment: z.string().optional().describe("New comment"),
        Billable: z.boolean().optional().describe("Whether this time is billable"),
      }),
    },
    async ({ TimeRegistrationID, TaskID, Date: date, Hours, Comment, Billable }) => {
      const body: Record<string, unknown> = {
        TimeRegistrationID,
        TaskID,
      };
      if (date !== undefined) body.Date = `${date}T00:00:00`;
      if (Hours !== undefined) body.Hours = Hours;
      if (Comment !== undefined) body.Comment = Comment;
      if (Billable !== undefined) body.Billable = Billable;

      const data = await client.post("/v1/time-registration/update-time", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
