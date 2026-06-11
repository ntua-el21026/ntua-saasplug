# AI Prompt Log

This file is the central index of ChatGPT/Codex-assisted implementation runs for the saasPlug project.

The official AI logging subsystem is considered unavailable for this project. Therefore, AI usage is documented manually in the repository through this prompt log and the per-run files under `docs/ai/codex-runs/`.

---

## Status legend

| Status | Meaning |
|---|---|
| `planned` | Prompt exists or is planned but has not been executed |
| `in-progress` | Prompt has been given to Codex and is being worked on |
| `completed` | Run finished and acceptance criteria passed |
| `partial` | Run finished but some acceptance criteria or checks remain unresolved |
| `failed` | Run could not complete |
| `superseded` | Run was replaced by a later run |

---

## Prompt/run index

| Run ID | Prompt file | Run log | Status | Goal | Summary | Checks |
|---:|---|---|---|---|---|---|
| 001 | `docs/ai/prompts/prompt_01_repo_foundation.md` | `docs/ai/codex-runs/001-repo-foundation.md` | `planned` | Repository foundation | Pending execution | Pending |

---

## Governance rules

1. Every Codex implementation run must have a row in this file.
2. Every Codex implementation run must have a corresponding run log under `docs/ai/codex-runs/`.
3. The run log must record the prompt received, files changed, tests/checks run, results, and limitations.
4. If a Codex run changes architecture-relevant files, the run log must explicitly state whether the changes conform to `docs/specs/SPECIFICATIONS.md`.
5. Failed GitHub CLI/API project-management actions must be reported as failures, not replaced with fallback Markdown project artifacts unless explicitly requested.
6. This file must be updated in the same run that performs the implementation work.

---

## Notes

- This log does not automatically capture the full ChatGPT planning conversation.
- Planning decisions are consolidated in `docs/specs/SPECIFICATIONS.md`.
- Implementation prompts are stored in `docs/ai/prompts/`.
- Run reports are stored in `docs/ai/codex-runs/`.
