#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { TimelogClient } from "./client.js";
import { registerGetCurrentUser } from "./tools/user.js";
import { registerGetWeeklyRegistrations } from "./tools/weekly.js";
import { registerGetRegistrationsByDateRange } from "./tools/range.js";
import { registerGetFinancialData } from "./tools/financial.js";
import { registerGetTimesheetStatus } from "./tools/timesheet.js";
import { registerSearchTasks } from "./tools/search-tasks.js";
import { registerCreateTimeRegistration } from "./tools/create-registration.js";
import { registerUpdateTimeRegistration } from "./tools/update-registration.js";
import { registerDeleteTimeRegistration } from "./tools/delete-registration.js";
import { registerSearchAbsenceCodes } from "./tools/search-absence-codes.js";
import { registerCreateAbsenceRegistration } from "./tools/create-absence-registration.js";
import { registerSubmitTimesheet } from "./tools/submit-timesheet.js";

const config = loadConfig();
const client = new TimelogClient(config);

const server = new McpServer({
  name: "timelog",
  version: "1.0.0",
});

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

const transport = new StdioServerTransport();
await server.connect(transport);
