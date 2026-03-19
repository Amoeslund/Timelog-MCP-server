# Timelog MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the [Timelog](https://www.timelog.com) time registration API as tools for Claude. It lets you view, create, and manage time registrations, absences, and timesheet approvals through natural language.

## Capabilities

- **View time registrations** — by week or arbitrary date range, including financial/billable data
- **Create, update, and delete** time registrations on any task you have access to
- **Absence management** — search absence codes and register vacation, sick leave, etc.
- **Timesheet approval** — check submission status and submit timesheets, with filtering by employee, department, approver, or legal entity
- **Organization** — look up legal entities and the current user profile
- **Task search** — find tasks to register time on by name or number

## Tools

### User & Organization

#### `get_current_user`
Get the authenticated user's profile (name, email, department). No parameters.

#### `get_legal_entities`
Get all legal entities in the organization. Returns ID, name, active status, currency, and country for each entity. No parameters.

### Time Registrations

#### `get_weekly_registrations`
Get time registrations for a specific week, grouped by day with norm hours.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Monday of the week (YYYY-MM-DD) |

#### `get_registrations_by_date_range`
Get time registrations between two dates.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |

#### `get_financial_data`
Get financial data (billable/invoice status) for time registrations in a date range.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |

#### `search_tasks`
Search for tasks the user can register time on. Returns task IDs needed for creating time registrations.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | No | Task name or task number to search for |
| `searchAll` | boolean | No | Search all tasks, not just recent (default: false) |

#### `create_time_registration`
Create a new time registration on a task. Use `search_tasks` first to find the TaskID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `TaskID` | integer | Yes | Task identifier (from `search_tasks`) |
| `Date` | string | Yes | Date of the registration (YYYY-MM-DD) |
| `Hours` | number | Yes | Number of hours to register |
| `Comment` | string | No | Comment for the registration |
| `JiraId` | string | No | JIRA ticket ID (e.g. XXX-1234) |
| `Billable` | boolean | No | Whether this time is billable (defaults to task setting) |

#### `update_time_registration`
Update an existing time registration. Only supply the fields you want to change.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `TimeRegistrationID` | integer | Yes | Time registration ID to update |
| `TaskID` | integer | Yes | Task identifier |
| `Date` | string | No | New date (YYYY-MM-DD) |
| `Hours` | number | No | New hours value |
| `Comment` | string | No | New comment |
| `JiraId` | string | No | JIRA ticket ID (e.g. SGI-82108) |
| `Billable` | boolean | No | Whether this time is billable |

#### `delete_time_registration`
Delete a time registration by its GUID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | GUID of the time registration to delete |

### Absence

#### `search_absence_codes`
Search for absence codes (e.g. Ferie, Sygdom). Returns AbsenceCodeID needed for `create_absence_registration`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `searchText` | string | No | Filter by absence code name or number |

#### `create_absence_registration`
Create an absence registration (vacation, sick leave, etc.). Use `search_absence_codes` to find the AbsenceCodeID. Registers a full working day by default.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `AbsenceCodeID` | integer | Yes | Absence code identifier (from `search_absence_codes`) |
| `Date` | string | Yes | Date of the absence (YYYY-MM-DD) |
| `Hours` | number | No | Hours to register (omit for a full working day) |
| `Comment` | string | No | Comment for the registration |

### Timesheet Approval

#### `get_timesheet_status`
Get weekly timesheet approval/submission status. Defaults to the authenticated user. Omit `userId` to get all employees (manager view).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |
| `userId` | integer | No | Filter by employee UserID (omit for all employees) |
| `departmentId` | integer | No | Filter by department ID |
| `approverId` | integer | No | Filter by approver UserID |
| `legalEntityId` | integer | No | Filter by legal entity ID |

#### `submit_timesheet`
Submit a timesheet for approval for a date range (e.g. a full week).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string | Yes | Start date (YYYY-MM-DD) |
| `endDate` | string | Yes | End date (YYYY-MM-DD) |
| `comment` | string | No | Comment for the submission |
| `employeeUserId` | integer | No | UserID of the employee to submit for (defaults to authenticated user) |

## Setup

### Via npx (recommended)

Add to your Claude Code `.mcp.json` or Claude Desktop config:

```json
{
  "mcpServers": {
    "timelog": {
      "command": "npx",
      "args": ["-y", "timelog-mcp"],
      "env": {
        "TIMELOG_PAT": "<your-personal-access-token>",
        "TIMELOG_BASE_URL": "https://app[X].timelog.com/<your-account>/api"
      }
    }
  }
}
```

### From source

```bash
git clone git@github.com:Amoeslund/Timelog-MCP-server.git
cd Timelog-MCP-server
npm install
npm run build
```

Then point your MCP config at the built file:

```json
{
  "mcpServers": {
    "timelog": {
      "command": "node",
      "args": ["/path/to/Timelog-MCP-server/dist/index.js"],
      "env": {
        "TIMELOG_PAT": "<your-personal-access-token>",
        "TIMELOG_BASE_URL": "https://app[X].timelog.com/<your-account>/api"
      }
    }
  }
}
```

## Configuration

### Personal Access Token

Generate a PAT at https://login.timelog.com/personaltoken.

### Base URL

Your URL follows the pattern `https://app[X].timelog.com/<your-account>/api` where `[X]` is a server number (1–10) and `<your-account>` is your Timelog account name. See the [Timelog API docs](https://api.timelog.com/rest/swagger) for details.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TIMELOG_PAT` | Yes | Personal Access Token (see above) |
| `TIMELOG_BASE_URL` | Yes | API base URL (see above) |

## License

ISC
