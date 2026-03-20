import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerCreateAbsenceRegistration(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "create_absence_registration",
    {
      description:
        "Create an absence registration (e.g. vacation, sick leave). Use search_absence_codes to find the AbsenceCodeID. Registers a full day by default; specify Hours for partial days.",
      inputSchema: z.object({
        AbsenceCodeID: z.union([z.number(), z.string().transform(Number)]).describe("Absence code identifier (from search_absence_codes)"),
        Date: z.string().describe("Date of the absence, format YYYY-MM-DD"),
        Hours: z.union([z.number(), z.string().transform(Number)]).optional().describe("Hours to register. If omitted, registers a full working day."),
        Comment: z.string().optional().describe("Comment for the registration"),
      }),
    },
    async ({ AbsenceCodeID, Date: date, Hours, Comment }) => {
      const body: Record<string, unknown> = {
        AbsenceID: AbsenceCodeID,
        Date: `${date}T00:00:00`,
      };
      if (Comment !== undefined) body.Comment = Comment;

      let endpoint: string;
      if (Hours !== undefined) {
        body.Hours = Hours;
        body.Minutes = Math.round(Hours * 60);
        endpoint = "/v1/absence-code/registration-by-hours";
      } else {
        endpoint = "/v1/absence-code/registration-by-full-day";
      }

      const data = await client.post(endpoint, body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
