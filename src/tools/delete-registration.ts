import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TimelogClient } from "../client.js";

export function registerDeleteTimeRegistration(server: McpServer, client: TimelogClient) {
  server.registerTool(
    "delete_time_registration",
    {
      description: "Delete a time registration by its GUID.",
      inputSchema: z.object({
        id: z.string().uuid().describe("GUID of the time registration to delete"),
      }),
    },
    async ({ id }) => {
      await client.delete(`/v1/time-registration/${id}`);
      return {
        content: [{ type: "text" as const, text: `Time registration ${id} deleted.` }],
      };
    },
  );
}
