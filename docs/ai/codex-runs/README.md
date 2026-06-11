# Codex Run Reports

This directory contains execution reports for Codex runs. It is the project-level substitute for the unavailable official AI logging subsystem.

## Naming Convention

Use stable run IDs that match the prompt/run order:

```text
000-audit-only.md
00B-logging-and-github-setup.md
001-repo-foundation.md
002-docker-gateway.md
003-auth-service.md
...
```

Use this template for every run report:

```text
docs/ai/codex-runs/_template.md
```

## Invocation Prompt vs Canonical Task Prompt

Each run report must distinguish:

- **Invocation Prompt**: the exact text pasted into Codex by the user.
- **Canonical Task Prompt**: the version-controlled prompt file under `docs/ai/prompts/`, when one is used.

If the user invokes a canonical prompt with a short instruction, record both the short instruction and the prompt file path. Copy the full canonical prompt content into the run report where practical. If it is not copied, explain why and provide the exact file path.

## Required Contents

Each run report must include:

- run metadata, including visible model/settings/sandbox/approval/network information;
- exact invocation prompt;
- canonical task prompt file path, if any;
- canonical prompt content or a documented reason for not copying it;
- goal and non-goals;
- canonical sources read;
- files created, modified, and intentionally not changed;
- commands run, including failures;
- implementation or audit summary;
- tests/checks and results;
- limitations, warnings, and blockers;
- GitHub project/issue/milestone/label actions, when applicable;
- final status;
- next recommended action.

## Status Values

Use one of:

- `COMPLETED`
- `COMPLETED_WITH_WARNINGS`
- `FAILED`
- `BLOCKED`
- `AUDIT_ONLY`

## Important Rules

- Do not hide failed commands.
- Do not claim tests passed if they were not run.
- Do not omit files changed by Codex.
- Do not use run reports as substitutes for actual GitHub Projects/issues unless explicitly requested.
- If GitHub Projects/Issues setup fails, record the exact failure and required manual action.
