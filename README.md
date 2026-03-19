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

| Tool | Description |
|------|-------------|
| **User & Organization** | |
| `get_current_user` | Get the authenticated user's profile (name, email, department) |
| `get_legal_entities` | Get all legal entities in the organization (ID, name, currency, country) |
| **Time Registrations** | |
| `get_weekly_registrations` | Get time entries for a specific week (provide the Monday date) |
| `get_registrations_by_date_range` | Get time entries between two dates |
| `get_financial_data` | Get billable/invoice status for registrations in a date range |
| `search_tasks` | Search for tasks you can register time on by name or number |
| `create_time_registration` | Register hours on a task with optional comment, billable flag, and JIRA ID |
| `update_time_registration` | Modify an existing registration (hours, comment, date, billable, JIRA ID) |
| `delete_time_registration` | Delete a registration by its GUID |
| **Absence** | |
| `search_absence_codes` | Search for absence codes (e.g. Ferie, Sygdom) |
| `create_absence_registration` | Register absence by full day or hours |
| **Timesheet Approval** | |
| `get_timesheet_status` | Get weekly approval/submission status — filterable by employee, department, approver, or legal entity |
| `submit_timesheet` | Submit a timesheet for approval for a date range |

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
