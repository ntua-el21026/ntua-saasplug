# AI Documentation

This directory contains the manual AI usage documentation for the saasPlug project.

The official AI logging subsystem is unavailable for this project, so the repository keeps its own trace of prompts, Codex runs, files changed, commands run, checks, warnings, and GitHub project-management actions.

## Prompt Types

AI logging distinguishes two prompt concepts:

| Term | Meaning |
|---|---|
| Invocation Prompt | The exact text pasted into Codex by the user for a run. It may be a short instruction or a full one-off task prompt. |
| Canonical Task Prompt | A version-controlled task prompt under `docs/ai/prompts/`, when a run uses one. |

Example invocation prompt:

```text
Read and execute docs/ai/prompts/prompt_01_repo_foundation.md.
Follow AGENTS.md and docs/specs/SPECIFICATIONS.md.
Update docs/ai/codex-runs/001-repo-foundation.md and docs/ai/prompt-log.md.
```

In that example, the short instruction is the invocation prompt, and `docs/ai/prompts/prompt_01_repo_foundation.md` is the canonical task prompt.

## Structure

```text
docs/ai/
  README.md
  prompt-log.md
  prompts/
    README.md
    prompt_00b_logging_and_github_setup.md
    prompt_01_repo_foundation.md
    ...
  codex-runs/
    README.md
    _template.md
    000-audit-only.md
    00B-logging-and-github-setup.md
    001-repo-foundation.md
    ...
```

## Main Files

| File or folder | Purpose |
|---|---|
| `prompt-log.md` | Central chronological index of AI/Codex runs. |
| `prompts/` | Version-controlled canonical task prompts. |
| `codex-runs/` | Execution reports produced after each Codex run. |
| `codex-runs/_template.md` | Required run-report template. |

## Required Workflow

The normal workflow is:

```text
short invocation prompt -> Codex reads canonical prompt file -> Codex executes task -> Codex writes run report -> Codex updates prompt-log
```

Each Codex run must update both:

```text
docs/ai/prompt-log.md
docs/ai/codex-runs/<run-id>-<run-name>.md
```

unless the prompt explicitly forbids repository writes.

Each run report must record:

- the exact invocation prompt;
- the canonical task prompt file path, when one is used;
- the full canonical task prompt content where practical;
- visible model/settings/sandbox/approval/network information;
- canonical sources read;
- files changed;
- commands run;
- tests/checks and results;
- GitHub project/issue/milestone actions when applicable;
- limitations, warnings, blockers, and final status.

Do not treat AI output as automatically accepted. Every Codex run must be reviewed against `AGENTS.md` and `docs/specs/SPECIFICATIONS.md`.
