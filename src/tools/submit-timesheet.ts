import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerSubmitTimesheet(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "submit_timesheet",
    {
      description: "Submit timesheet for approval for a date range (e.g. a full week).",
      inputSchema: z.object({
        startDate: z.string().describe("Start date YYYY-MM-DD"),
        endDate: z.string().describe("End date YYYY-MM-DD"),
        comment: z.string().optional().describe("Optional comment for the submission"),
        employeeUserId: z.coerce.number().int().optional().describe("UserID of the employee to submit for. Defaults to the authenticated user."),
      }),
    },
    async ({ startDate, endDate, comment, employeeUserId }) => {
      const body: Record<string, unknown> = {
        StartDate: `${startDate}T00:00:00`,
        EndDate: `${endDate}T00:00:00`,
      };
      if (comment !== undefined) body.Comment = comment;
      if (employeeUserId !== undefined) body.EmployeeUserID = employeeUserId;

      const data = await client.post("/v1/approval/timesheets/submit-period", body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
