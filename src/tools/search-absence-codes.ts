import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerSearchAbsenceCodes(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "search_absence_codes",
    {
      description:
        "Search for absence codes (e.g. Ferie, Sygdom). Returns AbsenceCodeID needed for create_absence_registration.",
      inputSchema: z.object({
        searchText: z.string().optional().describe("Filter by absence code name or number"),
      }),
    },
    async ({ searchText }) => {
      const params: Record<string, string> = {};
      if (searchText) params.searchText = searchText;
      const data = await client.get("/v1/absence-code/1", params); // status=1 (active only)
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
