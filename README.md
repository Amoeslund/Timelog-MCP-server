# Timelog MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the [Timelog](https://www.timelog.com) time registration API as tools for Claude.

## Tools

| Tool | Description |
|------|-------------|
| `get_current_user` | Get the authenticated user's profile |
| `get_weekly_registrations` | Get time entries for a specific week |
| `get_registrations_by_date_range` | Get time entries for an arbitrary date range |
| `get_financial_data` | Get billable/invoice status for registrations |
| `get_timesheet_status` | Get approval/submission status of timesheets |
| `search_tasks` | Search for tasks you can register time on |
| `create_time_registration` | Register hours on a task |
| `update_time_registration` | Modify an existing registration |
| `delete_time_registration` | Delete a registration |

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
        "TIMELOG_BASE_URL": "https://app3.timelog.com/<your-account>/api"
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
        "TIMELOG_BASE_URL": "https://app3.timelog.com/<your-account>/api"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TIMELOG_PAT` | Yes | Personal Access Token from https://login.timelog.com/personaltoken |
| `TIMELOG_BASE_URL` | Yes | API base URL, e.g. `https://app3.timelog.com/impact/api` |

## License

ISC
