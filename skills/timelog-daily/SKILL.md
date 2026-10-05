---
name: timelog-daily
description: Log today's hours in Timelog for an IMPACT employee. Collects today's work from Fellow meetings, Slack, git commits, Claude sessions and Jira, reconciles it against the day's allocation in Planning (IMPACT Datawarehouse), and creates the time registrations without asking. On the last workday of the month it also runs the weekly close (timelog-weekly). Use when the user asks to log, register or book today's hours/time in Timelog, or runs /timelog-daily.
---

# Log today's hours in Timelog

Build today's time registrations from the user's activity, make them match Planning, create them, and show the result as a table. **Do not ask for confirmation before creating registrations.** The user reviews them manually at the end of the week.

"Today" is the current local date (`YYYY-MM-DD`). All sources are filtered to today only.

## 0. Setup

1. Call the Timelog `get_current_user` tool to get the user's name, initials and email.
2. Call `get_registrations_by_date_range` for today. Existing registrations count toward the day's total. Never duplicate them. Only fill the gap.

## 1. Planning allocation (source of truth for the total)

Use the IMPACT Datawarehouse `query` tool. Planning identifies users by initials (e.g. `ABM`). If the initials are unknown, look them up in `StagePlanningData.employees` by name, since the email domain there may differ (`@impact.dk`).

```sql
SELECT a.[date], a.customerShortName, a.customerName, a.unit, a.hours, a.isHalfDay, a.[type],
       c.projectName, c.timelogCustomerNo
FROM StagePlanningData.allocations a
LEFT JOIN StagePlanningData.customers c
  ON c.customerShortName = a.customerShortName AND c.unit = a.unit
WHERE a.[user] = '<INITIALS>' AND a.[date] = '<TODAY>'
```

- The **sum of `hours`** is the target total for the day.
- Each planned customer gets **exactly its planned hours**.
- `customerShortName = 'F'` ("On Holiday") means a day off: register nothing for it. If the whole day is holiday, report that and stop.
- If there are no allocation rows, say so and use the employee's daily hours from `StagePlanningData.employees.hours` (normally 7.5) as the total.

## 2. Collect today's activity

Gather these in parallel where possible. If a source is unavailable, note it in the final output and continue with the rest.

1. **Fellow meetings**: search today's meetings with the Fellow MCP tools (`search_meetings`, then `get_meeting_summary` where the title is unclear). Record title, duration and participants.
   - **Ignore** "Tid til at fokusere" and Lunch.
   - **1:1s and AI SME Group meetings are internal time on Timelog task `72819`.**
2. **Slack**: search the Slack MCP for messages the user sent today (`from:me on:today`) and DMs/mentions received today. Use them to work out which customers and tickets the user worked on.
3. **Git commits**: across all branches, today only, by the user. Check the current repo and other git repos under the home directory (e.g. `~/code`, `~/src`, `~/repos`, `~/projects`, max depth 3):
   ```bash
   git -C <repo> log --all --since=midnight --author="<email or name>" --format='%h %ad %s %D' --date=iso
   ```
   Match on every email the user commits with (`git config user.email` plus the Timelog/IMPACT emails). Pull Jira keys (`[A-Z]{2,5}-\d+`, e.g. `SGI-82108`) out of commit messages and branch names.
4. **Claude session history**: today's sessions from `~/.claude/projects/*/*.jsonl` (entries with today's `timestamp`). When the remote-session tools are available, also check today's cloud sessions (`list_sessions`, `mine: true`). Summarise what each session worked on, and collect repo names and Jira keys.
5. **Jira**: if the Atlassian MCP server is available:
   - Search JQL `assignee = currentUser() AND updated >= startOfDay()` with fields `["summary","status","issuetype","updated"]`.
   - For each Jira key found in commits, PRs and branches, call `getJiraIssue` to get its summary, issue type and parent epic.
   - If Atlassian auth fails, tell the user to run `/mcp` to reconnect it. Then fall back to the datawarehouse (`dbo.JiraCloud_Issues` for Jira Cloud, `dbo.JiraIssues` for jira.impact.dk) to resolve keys and summaries.

## 3. Build the registrations

1. Group activity into tasks: one registration per piece of work (ticket, epic, meeting block). Avoid one big block per customer.
2. Find Timelog task IDs with `search_tasks` (use `searchAll: true` if the first search finds nothing), searching by customer/project name from Planning.
   - **Prefer the task matching the Jira epic** (or the most specific feature task) over a generic "Development" task. Use generic Development only when nothing more specific exists.
3. Put the Jira ID (`XXX-12345`) in the `JiraId` field wherever the work maps to a ticket. When the activity names no ticket, search Jira for tickets matching the work (summary keywords, the user's updated tickets) and use the best match.
4. Write a short, specific comment on every registration (what was done, not just the ticket title).
5. **Reconcile with Planning:**
   - The day's total (existing plus new) must equal the Planning total exactly.
   - Hours per customer must equal the planned hours for that customer.
   - Internal meetings (task `72819`) are the only allowed exception. Take their hours from the largest planned customer so the day total still matches Planning.
   - Scale and round task hours to 0.25h so each customer adds up to its planned hours. Give leftover time to the customer's most-worked epic task.
   - If the activity shows nothing for a planned customer, still register its planned hours on that customer's most likely task and flag it in the output.

## 4. Create and report

1. Create each registration with `create_time_registration` (`TaskID`, `Date`, `Hours`, `Comment`, `JiraId`). Do not ask first.
2. Show one table:

   | Customer | Task (ID) | Jira | Hours | Comment | Source |
   |---|---|---|---|---|---|

   Follow it with a total row, the Planning total for comparison, and a short list of anything flagged (missing sources, guessed tasks, unmatched tickets, failed creations).

## 5. Last workday of the month

If today is the last workday of the month, run the full **timelog-weekly** skill after logging today. The last workday is the last Monday–Friday of the month that is not a holiday (`F`) in Planning. Run it with one change: the week to verify and submit runs from this week's Monday **through today**, not through Friday, so the month closes in Timelog.
