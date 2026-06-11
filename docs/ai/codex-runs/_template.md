# Codex Run <RUN_ID> - <RUN_TITLE>

## 1. Run metadata

| Field | Value |
|---|---|
| Run ID | `<RUN_ID>` |
| Prompt file | `<docs/ai/prompts/...>` |
| Date/time | `<YYYY-MM-DD HH:MM TZ>` |
| Codex environment | `<local / cloud / unknown>` |
| Repository branch | `<branch>` |
| Commit before run | `<commit hash or unknown>` |
| Commit after run | `<commit hash or not committed>` |
| Status | `<planned / completed / partial / failed>` |

---

## 2. Prompt received

Paste the full prompt used for this run, or include a precise reference if the full prompt is already committed in `docs/ai/prompts/` and was not modified.

```text
<prompt text or reference>
```

---

## 3. Goal

Describe the intended goal of this run.

---

## 4. Pre-flight repository state

Summarize the relevant repository state before changes.

Include:

- important existing files,
- missing expected files,
- notable constraints,
- any ambiguity found before editing.

---

## 5. Files created

| File | Purpose |
|---|---|
| `<path>` | `<purpose>` |

---

## 6. Files modified

| File | Summary of changes |
|---|---|
| `<path>` | `<summary>` |

---

## 7. Files intentionally not changed

List important files or areas that were intentionally preserved.

| File/area | Reason |
|---|---|
| `<path>` | `<reason>` |

---

## 8. Implementation summary

Summarize the actual implementation work completed in this run.

---

## 9. Checks and commands run

| Command | Result | Notes |
|---|---|---|
| `<command>` | `<pass/fail/not applicable>` | `<notes>` |

---

## 10. Acceptance criteria verification

| Criterion | Status | Notes |
|---|---|---|
| `<criterion>` | `<pass/fail/partial/not applicable>` | `<notes>` |

---

## 11. Known limitations

List any known limitations, incomplete tasks, skipped checks, or assumptions.

---

## 12. Errors or failures

Document errors, failed commands, permission issues, missing tools, missing files, or external-service failures.

If GitHub CLI/API actions were requested and failed, report that failure here. Do not create fallback Markdown project-management substitutes unless explicitly requested.

---

## 13. Manual follow-up required

List required human actions, if any.

---

## 14. Next recommended prompt

State the next prompt that should run, if appropriate.

Example:

```text
Next: docs/ai/prompts/prompt_02_docker_gateway.md
```
