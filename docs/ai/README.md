# AI Documentation

This directory contains the manual AI usage documentation for the saasPlug project.

## Purpose

The course project uses AI-assisted development. Because the official AI logging subsystem is unavailable, this repository keeps a manual, repository-based AI documentation trail.

The documentation in this directory should make it possible to understand:

- which prompts were used
- which Codex runs were executed
- what each run attempted to do
- what files were changed
- what tests/checks were run
- what limitations or blockers were reported

## Structure

```text
docs/ai/
  README.md
  prompt-log.md
  prompts/
    README.md
    prompt_01_repo_foundation.md
    ...
  codex-runs/
    README.md
    _template.md
    000-audit-only.md
    001-repo-foundation.md
    ...
```

## Main files

| File or folder | Purpose |
|---|---|
| `prompt-log.md` | Central chronological index of AI/Codex runs |
| `prompts/` | Version-controlled prompts used to guide Codex |
| `codex-runs/` | Execution reports produced after each Codex run |
| `codex-runs/_template.md` | Template for consistent run reports |

## Logging rule

Each Codex run should create or update one run report under `docs/ai/codex-runs/`.

Each run report should include:

- exact prompt text or prompt file path
- visible model/settings, if available
- goal of the run
- files inspected
- files changed
- commands run
- tests/checks and results
- implementation summary
- limitations/blockers
- final status

## Prompt workflow

The preferred workflow is:

1. Store the next prompt under `docs/ai/prompts/`.
2. Ask Codex to read and execute that prompt.
3. Ask Codex to write a run report under `docs/ai/codex-runs/`.
4. Update `docs/ai/prompt-log.md`.
5. Review Codex output before moving to the next prompt.

Do not treat AI output as automatically accepted. Every Codex run must be reviewed against `AGENTS.md` and `docs/specs/SPECIFICATIONS.md`.
