# Codex Run <RUN_ID> - <RUN_TITLE>

## 1. Run Metadata

Record the stable facts for the run.

| Field | Value |
|---|---|
| Run ID | `<RUN_ID>` |
| Date/time | `<YYYY-MM-DD HH:MM TZ>` |
| Working directory | `<absolute path>` |
| Repository branch | `<branch>` |
| Commit before run | `<commit hash or unknown>` |
| Commit after run | `<commit hash or not committed>` |
| Codex model | `<visible model or not visible to Codex>` |
| Reasoning effort | `<visible setting or not visible to Codex>` |
| Approval policy | `<visible setting or not visible to Codex>` |
| Sandbox mode | `<visible setting or not visible to Codex>` |
| Network access | `<visible setting or not visible to Codex>` |
| Status | `<completed / completed_with_warnings / failed / blocked / audit_only>` |

## 2. Invocation Prompt

Paste the exact text the user provided to invoke this Codex run.

```text
<exact invocation prompt>
```

## 3. Canonical Task Prompt

Record the version-controlled prompt file used as the task authority, if any.

| Field | Value |
|---|---|
| Canonical prompt file | `<docs/ai/prompts/... or none>` |
| Relationship to invocation prompt | `<direct prompt / invocation references canonical prompt / canonical prompt saved from invocation>` |

If no canonical task prompt exists, write `none` and explain that the invocation prompt is the only task prompt.

## 4. Canonical Task Prompt Content

Copy the full canonical task prompt content where practical.

```text
<full canonical prompt content, or a precise file reference plus the reason it is not copied>
```

## 5. Goal

Describe the intended goal and explicit non-goals for this run.

## 6. Canonical Sources Read

List the canonical project files and any task-specific files read before making changes.

| File | Purpose |
|---|---|
| `<path>` | `<why it was read>` |

## 7. Files Changed

List created and modified files separately. State `none` when applicable.

### Created

| File | Purpose |
|---|---|
| `<path>` | `<purpose>` |

### Modified

| File | Summary |
|---|---|
| `<path>` | `<summary>` |

### Intentionally Not Changed

| File/area | Reason |
|---|---|
| `<path or area>` | `<reason>` |

## 8. Commands Run

Record every relevant command, including failed commands.

| Command | Result | Notes |
|---|---|---|
| `<command>` | `<pass/fail/partial/not applicable>` | `<notes>` |

## 9. Implementation / Audit Summary

Summarize what was actually done. For audit-only runs, summarize findings instead of implementation.

## 10. Tests and Checks

Record tests, lint, type checks, build checks, GitHub verification, or explain why they were not applicable.

| Check | Result | Notes |
|---|---|---|
| `<check>` | `<pass/fail/partial/not applicable>` | `<notes>` |

## 11. Limitations, Warnings, and Blockers

Document incomplete work, warnings, blockers, assumptions, missing tools, failed commands, and follow-up requirements.

## 12. GitHub Project / Issue / Milestone Actions

If GitHub project-management actions were requested, record exactly what was created, reused, skipped, or failed. If no GitHub actions were requested, write `Not applicable`.

| Action | Result | Notes |
|---|---|---|
| `<labels/milestones/project/issues/etc.>` | `<created/reused/failed/skipped>` | `<details>` |

Do not create fallback Markdown project-management artifacts unless explicitly requested.

## 13. Final Status

Use one final status and explain it briefly.

```text
<COMPLETED / COMPLETED_WITH_WARNINGS / FAILED / BLOCKED / AUDIT_ONLY>
```

## 14. Next Recommended Action

State the exact next prompt or manual action, if any.

```text
<next action>
```
