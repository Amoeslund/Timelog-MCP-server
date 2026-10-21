import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TimelogClient } from "../client.js";
import { registerGetCurrentUser } from "./user.js";
import { registerGetWeeklyRegistrations } from "./weekly.js";
import { registerGetRegistrationsByDateRange } from "./range.js";
import { registerGetFinancialData } from "./financial.js";
import { registerGetTimesheetStatus } from "./timesheet.js";
import { registerSearchTasks } from "./search-tasks.js";
import { registerCreateTimeRegistration } from "./create-registration.js";
import { registerUpdateTimeRegistration } from "./update-registration.js";
import { registerDeleteTimeRegistration } from "./delete-registration.js";
import { registerSearchAbsenceCodes } from "./search-absence-codes.js";
import { registerCreateAbsenceRegistration } from "./create-absence-registration.js";
import { registerSubmitTimesheet } from "./submit-timesheet.js";
import { registerGetLegalEntities } from "./legal-entity.js";

// Shared by the stdio entry point and the hosted HTTP server, so both expose the same tools.
export function registerAllTools(server: McpServer, client: TimelogClient) {
  registerGetCurrentUser(server, client);
  registerGetWeeklyRegistrations(server, client);
  registerGetRegistrationsByDateRange(server, client);
  registerGetFinancialData(server, client);
  registerGetTimesheetStatus(server, client);
  registerSearchTasks(server, client);
  registerCreateTimeRegistration(server, client);
  registerUpdateTimeRegistration(server, client);
  registerDeleteTimeRegistration(server, client);
  registerSearchAbsenceCodes(server, client);
  registerCreateAbsenceRegistration(server, client);
  registerSubmitTimesheet(server, client);
  registerGetLegalEntities(server, client);
}
