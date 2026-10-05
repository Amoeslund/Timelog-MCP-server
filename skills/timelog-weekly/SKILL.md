---
name: timelog-weekly
description: Close the week in Timelog for an IMPACT employee. Fetches this week's registrations, checks each day totals 7.5h (0h on holidays), backfills missing Jira IDs, shows the week summary, sends it to the user on Slack, then submits the timesheet. Use when the user asks to close, check, verify or submit their week or timesheet, or runs /timelog-weekly. timelog-daily also runs it on the last workday of the month.
---

# Close the week in Timelog

The week runs Monday → Friday of the current week. When this is run from **timelog-daily** on the last workday of the month, it runs Monday → today instead.

## 1. Get the week's registrations

Call the Timelog `get_weekly_registrations` tool with `startDate` = this week's Monday (`YYYY-MM-DD`). Call `get_current_user` if you need the user's initials, name or email.

## 2. Verify daily totals

Each workday must total **7.5h**. Holidays must total **0h**.

Get holidays and expected hours from Planning (IMPACT Datawarehouse `query` tool). Days with `customerShortName = 'F'` ("On Holiday") are holidays:

```sql
SELECT a.[date], a.customerShortName, a.customerName, a.hours
FROM StagePlanningData.allocations a
WHERE a.[user] = '<INITIALS>' AND a.[date] BETWEEN '<MONDAY>' AND '<END>'
ORDER BY a.[date]
```

The expected daily hours come from `StagePlanningData.employees.hours` (normally 7.5). For each day that is off:

- **Under:** if the day has no registrations at all, run the **timelog-daily** skill for that date (use that date wherever it says today). Otherwise top up the gap on the day's largest planned customer task.
- **Over:** reduce the most generic registration (e.g. "Development") with `update_time_registration` until the day matches.

Do this without asking. Record every correction for the summary.

## 3. Backfill missing Jira IDs

For each registration without a `JiraId`:

1. Take keywords from the comment, task name and date. Collect Jira keys from that day's git commits and branch names (`git log --all --since=<date> --until=<date+1>`).
2. If the Atlassian MCP server is available, search Jira (JQL such as `assignee = currentUser() AND updated >= "<date>" AND updated < "<date+1>"`, fields `["summary","status","issuetype","updated"]`). Use `getJiraIssue` to confirm a match. If auth fails, tell the user to run `/mcp` to reconnect it. Then fall back to the datawarehouse (`dbo.JiraCloud_Issues` / `dbo.JiraIssues`).
3. When a ticket clearly matches, set it with `update_time_registration` (pass the existing `TaskID`, `Hours` and `Comment` along with the new `JiraId`). Leave ambiguous ones empty and list them in the summary.

Internal-time registrations (task `72819`: 1:1s, AI SME Group) don't need a Jira ID.

## 4. Show the summary and send it to the user on Slack

Build the full week table:

| Day | Date | Customer | Task (ID) | Jira | Hours | Comment |
|---|---|---|---|---|---|---|

Follow it with:

- a per-day totals line (✅ 7.5h / 🏖 holiday 0h / ⚠️ mismatch);
- a week total;
- the corrections and backfills made in steps 2–3;
- anything still unresolved.

Show the table here, then send the same summary to the user on Slack **before submitting**. Find the user's own Slack user ID (search users by their email or name), and send the message to that ID as a DM to themselves.

## 5. Submit the timesheet

Call `submit_timesheet` with `startDate` = Monday and `endDate` = Friday (or today, in the month-end case). If any day still doesn't total its expected hours after step 2, do not submit. Report which days block submission. Otherwise submit, and say that the timesheet was submitted.
