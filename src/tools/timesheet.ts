import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerGetTimesheetStatus(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "get_timesheet_status",
    {
      description:
        "Get weekly timesheet status. Defaults to the authenticated user. Pass userId to check a specific employee, or omit to get all employees (manager view). Can also filter by departmentId, approverId, or legalEntityId.",
      inputSchema: z.object({
        startDate: z.string().describe("Start date YYYY-MM-DD"),
        endDate: z.string().describe("End date YYYY-MM-DD"),
        userId: z.union([z.number(), z.string().transform(Number)]).optional().describe("Filter by employee UserID. Omit for all employees."),
        departmentId: z.union([z.number(), z.string().transform(Number)]).optional().describe("Filter by department ID"),
        approverId: z.union([z.number(), z.string().transform(Number)]).optional().describe("Filter by approver UserID"),
        legalEntityId: z.union([z.number(), z.string().transform(Number)]).optional().describe("Filter by legal entity ID"),
      }),
    },
    async ({ startDate, endDate, userId, departmentId, approverId, legalEntityId }) => {
      let resolvedUserId = userId;
      if (resolvedUserId === undefined) {
        const me = await client.get<{ Properties: { UserID: number } }>("/v1/user/me");
        resolvedUserId = me.Properties.UserID;
      }

      const params: Record<string, string> = {
        startDate: `${startDate}T00:00:00`,
        endDate: `${endDate}T00:00:00`,
        userId: String(resolvedUserId),
      };
      if (departmentId !== undefined) params.departmentId = String(departmentId);
      if (approverId !== undefined) params.approverId = String(approverId);
      if (legalEntityId !== undefined) params.legalEntityId = String(legalEntityId);

      const data = await client.get("/v1/timesheet-status/weekly", params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
