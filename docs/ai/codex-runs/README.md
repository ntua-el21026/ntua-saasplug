# Codex Run Reports

This directory contains execution reports for Codex runs.

## Purpose

A Codex run report records what happened during a specific Codex audit or implementation step. It is the project-level substitute for unavailable official AI logs.

## Naming convention

Use numeric prefixes matching the prompt/run order:

```text
000-audit-only.md
001-repo-foundation.md
002-docker-gateway.md
003-auth-service.md
...
```

The template is:

```text
_template.md
```

## Required contents

Each run report should include:

- run ID and title
- timestamp
- prompt file or full prompt text
- visible model/settings, if available
- repository state before the run
- commands run
- files inspected
- files changed
- implementation summary
- tests/checks performed
- results
- limitations/blockers
- final status

## Status values

Use one of:

- `completed`
- `completed_with_warnings`
- `failed`
- `audit_only`
- `blocked`

## Important rules

- Do not hide failed commands.
- Do not claim tests passed if they were not run.
- Do not omit files changed by Codex.
- Do not use these reports as substitutes for actual GitHub Projects/issues unless explicitly requested.
- If GitHub Projects/Issues setup fails, record the failure clearly and let the user handle it manually.
