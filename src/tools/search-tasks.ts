import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerSearchTasks(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "search_tasks",
    {
      description:
        "Search for tasks the user can register time on. Returns task IDs needed for creating time registrations. Use searchText to filter by task or project name.",
      inputSchema: z.object({
        searchText: z.string().optional().describe("Task name or task number to search for"),
        searchAll: z.boolean().optional().describe("Search all tasks, not just recent (default false)"),
      }),
    },
    async ({ searchText, searchAll }) => {
      const params: Record<string, string> = {};
      if (searchText) params.searchText = searchText;
      if (searchAll) params.searchAll = "true";
      const data = await client.get("/v1/task/search-for-time-tracking", params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
