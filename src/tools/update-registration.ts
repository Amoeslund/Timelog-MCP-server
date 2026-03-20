import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerUpdateTimeRegistration(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "update_time_registration",
    {
      description: "Update an existing time registration (hours, comment, date, billable status).",
      inputSchema: z.object({
        TimeRegistrationID: z.union([z.number(), z.string().transform(Number)]).describe("Time registration ID to update"),
        TaskID: z.union([z.number(), z.string().transform(Number)]).describe("Task identifier"),
        Date: z.string().optional().describe("New date, format YYYY-MM-DD"),
        Hours: z.union([z.number(), z.string().transform(Number)]).optional().describe("New hours value"),
        Comment: z.string().optional().describe("New comment"),
        JiraId: z.string().optional().describe("JIRA ticket ID (e.g. SGI-82108)"),
        Billable: z.boolean().optional().describe("Whether this time is billable"),
      }),
    },
    async ({ TimeRegistrationID, TaskID, Date: date, Hours, Comment, JiraId, Billable }) => {
      const body: Record<string, unknown> = {
        TimeRegistrationID,
        TaskID,
      };
      if (date !== undefined) body.Date = `${date}T00:00:00`;
      if (Hours !== undefined) {
        const minutes = Math.round(Hours * 60);
        const billable = Billable !== false;
        body.Hours = Hours;
        body.Minutes = minutes;
        body.Billable = billable;
        body.BillableHours = billable ? Hours : 0;
        body.BillableMinutes = billable ? minutes : 0;
      } else if (Billable !== undefined) {
        body.Billable = Billable;
      }
      if (Comment !== undefined) body.Comment = Comment;
      if (JiraId !== undefined) body.AdditionalComment = JiraId;

      const data = await client.post("/v1/time-registration/update-time", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
