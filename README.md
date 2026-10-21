# Timelog MCP Server

An [MCP](https://modelcontextprotocol.io) server that exposes the [Timelog](https://www.timelog.com) time registration API as tools for Claude. It lets you view, create, and manage time registrations, absences, and timesheet approvals through natural language.

## Requirements

**Node.js 18 or higher** — the server uses the native `fetch` global, which was introduced in Node 18. Running on an older version will exit immediately with a clear error message.

The included `.nvmrc` and `bin/run.sh` wrapper target **Node 22**, which is the recommended version for running this server.

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

### Manager Workflows

#### Finding and closing open timesheets

Use `get_timesheet_status` without a `userId` to get the submission status for all employees in a period. Filter by `departmentId`, `approverId`, or `legalEntityId` to narrow the scope.

Once you've identified employees with open timesheets, use `submit_timesheet` with `employeeUserId` to submit on their behalf.

**Example prompts:**
> "Show me everyone who hasn't submitted their timesheet this week"
> "Submit this week's timesheet for user 1234"
> "Submit all open timesheets for department 5 this week"

## Hosted on Azure (recommended)

IMPACT runs this server centrally on Azure App Service, like the other IMPACT MCP connectors, so
users install nothing locally. Each user signs in with their own Timelog personal access token,
so Timelog's own permissions apply per person.

### Connecting a client

The server implements OAuth with dynamic client registration, so a client needs only the URL.

**Claude.ai / Claude desktop:** Settings → Connectors → *Add custom connector* →
`https://impact-timelog-mcp-connector.azurewebsites.net/mcp`

**Claude Code:**

```bash
claude mcp add --transport http timelog https://impact-timelog-mcp-connector.azurewebsites.net/mcp
```

Then run `/mcp` and choose **Authenticate**. A browser page asks for your Timelog personal access
token (create one at https://login.timelog.com/personaltoken). That is the only time you enter it.

### How sign-in works

- `/authorize` shows a page where the user pastes their PAT. The server checks it against Timelog
  (`GET /v1/user/me`) before continuing.
- The access token the client receives is the PAT **encrypted** (AES-256-GCM) with a key only the
  server holds. Client ids and authorization codes are sealed the same way.
- So the server stores nothing: no token table, no database. Restarts and scale-out do not sign
  anyone out. The only secret in Azure is the encryption key, in Key Vault.
- Access tokens expire after `ACCESS_TOKEN_TTL_DAYS` (default 30); the user then pastes a PAT again.
- To disconnect, revoke the PAT in Timelog. Rotating the encryption key signs every user out.
- Redirect URIs are limited to `ALLOWED_REDIRECT_HOSTS` (default: claude.ai, claude.com and
  loopback for Claude Code), so a third-party site cannot register itself to collect PATs.

### Azure resources (`infra/main.bicep`)

| Resource | Purpose |
|---|---|
| App Service plan (Linux, B1) + Web App | Runs `node dist/http.js` on Node 22 |
| User-assigned managed identity | Reads the encryption key from Key Vault |
| Key Vault (RBAC) | Holds `token-encryption-key` |
| Log Analytics workspace | Console, HTTP and platform logs |

Health check: `https://<site>.azurewebsites.net/healthz` → `{"status":"ok"}`.

### Deploying

Deploys run from GitHub Actions: **Deploy to test** / **Deploy to production** (manual
dispatch, with a "code only" option that skips the Bicep pass). They authenticate to Azure with
OIDC, so no Azure secret is stored in GitHub.

One-time setup per environment (`test`, `prod`):

1. **Resource group** in Azure (ask IT for it).
2. **Entra app registration** with a federated credential for
   `repo:<owner>/<repo>:environment:<test|prod>`, and on the resource group the roles
   **Contributor** and **Role Based Access Control Administrator** (the template assigns the
   identity's Key Vault role).
3. **GitHub Environment** with:

   | Kind | Name | Value |
   |---|---|---|
   | Variable | `AZURE_CLIENT_ID` | App registration client id |
   | Variable | `AZURE_TENANT_ID` | Tenant id |
   | Variable | `AZURE_SUBSCRIPTION_ID` | Subscription id |
   | Variable | `AZURE_RESOURCE_GROUP` | Resource group name |
   | Variable | `SITE_NAME` | e.g. `impact-timelog-mcp-connector` (test: `impact-timelog-mcp-connector-test`) |
   | Variable | `TIMELOG_BASE_URL` | `https://app[X].timelog.com/<account>/api` |
   | Secret | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` — keep it stable |

To deploy by hand instead: `az login`, then run `scripts/deploy.sh` with the same values as
environment variables.

### Running the hosted server locally

```bash
npm install && npm run build
TIMELOG_BASE_URL=https://app[X].timelog.com/<account>/api \
PUBLIC_BASE_URL=http://localhost:8080 \
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32) \
npm run start:http
```

### Hosted server environment variables

| Variable | Default | Purpose |
|---|---|---|
| `TIMELOG_BASE_URL` | *(required)* | Timelog API base URL for the organisation |
| `PUBLIC_BASE_URL` | *(required)* | Public origin, used in OAuth discovery |
| `TOKEN_ENCRYPTION_KEY` | *(required)* | Base64 32-byte AES key (Key Vault reference in Azure) |
| `ACCESS_TOKEN_TTL_DAYS` | `30` | Access token lifetime |
| `ALLOWED_REDIRECT_HOSTS` | `claude.ai,claude.com,localhost,127.0.0.1` | Hosts a client may register as redirect target |
| `TRUSTED_PROXY_HOPS` | `0` | Reverse proxies in front (Azure sets `1`) |
| `PORT` | `8080` | Injected by App Service |

## Local install (stdio, legacy)

The options below run the server on your own machine. They still work, but the hosted server
above is the supported way to use it at IMPACT.

## Setup

### As a Claude Code plugin (recommended)

This repo doubles as a Claude Code plugin marketplace. Add it once, then install the plugin:

```
/plugin marketplace add Amoeslund/Timelog-MCP-server
/plugin install timelog@timelog-mcp
```

Claude Code will prompt for your **Timelog Personal Access Token** and **API base URL** during install and wire up the MCP server for you (it runs a pinned version of the published `timelog-mcp` package via `npx`). No manual `.mcp.json` editing required. See [Configuration](#configuration) for how to obtain those values.

### Via npx (manual)

Add to your Claude Code `.mcp.json` or Claude Desktop config:

```json
{
  "mcpServers": {
    "timelog": {
      "command": "npx",
      "args": ["-y", "timelog-mcp@1.8.1"],
      "env": {
        "TIMELOG_PAT": "<your-personal-access-token>",
        "TIMELOG_BASE_URL": "https://app[X].timelog.com/<your-account>/api"
      }
    }
  }
}
```

> **Pin the version.** Always reference an exact version (`timelog-mcp@<version>`) in `args` rather than bare `timelog-mcp`. An unpinned `npx -y` silently pulls whatever is tagged `latest` on every launch, which exposes you to unreviewed or compromised releases. Check the available versions with `npm view timelog-mcp versions` and bump the pin deliberately when you upgrade.

The package includes a wrapper script (`bin/run.sh`) that sources nvm at startup and runs the server with the version declared in `.nvmrc` (Node 22). This means the correct Node version is selected on every run, regardless of what your shell's default is.

> **nvm users:** MCP servers run as subprocesses and don't inherit nvm shell hooks, so your shell's active version doesn't apply. The wrapper handles this automatically. If you prefer to use `npx` directly without the wrapper, make sure your nvm default is Node 18+:
> ```bash
> nvm alias default 22
> ```

### From source

```bash
git clone git@github.com:Amoeslund/Timelog-MCP-server.git
cd Timelog-MCP-server
nvm use        # picks up .nvmrc (Node 22)
npm install
npm run build
```

Then point your MCP config at the wrapper script so the correct Node version is used on every launch:

```json
{
  "mcpServers": {
    "timelog": {
      "command": "/path/to/Timelog-MCP-server/bin/run.sh",
      "args": [],
      "env": {
        "TIMELOG_PAT": "<your-personal-access-token>",
        "TIMELOG_BASE_URL": "https://app[X].timelog.com/<your-account>/api"
      }
    }
  }
}
```

Alternatively, if you want to call `node` directly, use an absolute path to a Node 18+ binary:

```json
{
  "mcpServers": {
    "timelog": {
      "command": "/path/to/node",
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
