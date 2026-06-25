# Automation Log Schema

Every automation task — no exceptions — gets one entry in `automation-log.jsonl`.

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 | When the task ran (local time with offset) |
| `client` | string | Client name or "internal" for 11R own work |
| `project` | string | Project/site name or repo |
| `model` | string | Model alias used: phi4, qwen-coder, Haiku, Sonnet, Opus |
| `task` | string | One-line description of what was requested |
| `files_changed` | string[] | Exact list of files written/deleted/moved |
| `commands_run` | string[] | Shell commands executed |
| `success` | boolean | Did the task complete without errors |
| `human_approval` | boolean | Did Alex explicitly approve before destructive action |
| `rollback` | string | How to undo — git revert, file backup path, "N/A" |

## Log File

Append one JSON line per task to:
`logs/automations/automation-log.jsonl`

## Example Entry

```json
{"timestamp":"2026-06-24T23:37:00-04:00","client":"11R Print","project":"websitee","model":"qwen-coder","task":"Redesign custom-order.html mobile layout","files_changed":["public/custom-order.html"],"commands_run":["git add public/custom-order.html","git commit -m '...'"],"success":true,"human_approval":true,"rollback":"git revert HEAD"}
```

## Rules

- Log BEFORE committing or deploying — not after
- `human_approval: false` is allowed for safe read-only tasks only
- `human_approval: true` required whenever `files_changed` includes a delete, overwrite, or deploy
- Never log secret values — log file paths only
- One entry per discrete task, not per file changed
