import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TimelogClient } from "../client.js";

interface UserMeResponse {
  Properties: { UserID: number };
}

export function registerCreateTimeRegistration(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "create_time_registration",
    {
      description:
        "Create a new time registration on a task. Use search_tasks first to find the TaskID.",
      inputSchema: z.object({
        TaskID: z.number().int().describe("Task identifier (from search_tasks)"),
        Date: z.string().describe("Date of the registration, format YYYY-MM-DD"),
        Hours: z.number().describe("Number of hours to register"),
        Comment: z.string().optional().describe("Comment for the registration"),
        JiraId: z.string().optional().describe("JIRA ticket ID (e.g. XXX-1234)"),
        Billable: z.boolean().optional().describe("Whether this time is billable (default from task settings)"),
      }),
    },
    async ({ TaskID, Date: date, Hours, Comment, JiraId, Billable }) => {
      const me = await client.get<UserMeResponse>("/v1/user/me");
      const billable = Billable !== false;
      const body: Record<string, unknown> = {
        ID: randomUUID(),
        TaskID,
        UserID: me.Properties.UserID,
        Date: `${date}T00:00:00`,
        Hours,
        Minutes: Math.round(Hours * 60),
        BillableHours: billable ? Hours : 0,
        BillableMinutes: billable ? Math.round(Hours * 60) : 0,
        GroupType: 1, // 1 = Project
      };
      if (Comment !== undefined) body.Comment = Comment;
      if (JiraId !== undefined) body.AdditionalComment = JiraId;
      body.Billable = billable;

      const data = await client.post("/v1/time-registration", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
