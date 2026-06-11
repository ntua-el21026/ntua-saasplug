# Codex Prompt 00B - AI Logging Workflow Update and GitHub Project Setup

## Task type

Pre-implementation repository setup.

This run must update the AI logging workflow files, verify the canonical GitHub remote repository, and attempt direct GitHub project-management setup for the repository.

This is not an application implementation prompt.

Do not implement application logic.
Do not create microservices.
Do not implement frontend code.
Do not implement Docker Compose runtime.
Do not install dependencies.
Do not create Markdown fallback project-management artifacts.

## Canonical repository target

The canonical GitHub repository is:

```text
ntua-el21026/NTUA-saasPlug
```

The local git remote must point to the canonical repository unless there is a clear reason it cannot be changed.

If a mismatch is found, report it and update the local `origin` remote only if the canonical repository is accessible and the current remote is clearly not the intended canonical target.

## Canonical project sources

Before changing anything, read:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/README.md`
4. `docs/ai/prompts/README.md`
5. `docs/ai/codex-runs/_template.md`
6. `docs/ai/prompt-log.md`
7. `docs/ai/codex-runs/000-audit-only.md`
8. `docs/ai/prompts/prompt_01_repo_foundation.md`

If anything conflicts with `AGENTS.md` or `docs/specs/SPECIFICATIONS.md`, follow `AGENTS.md` and `docs/specs/SPECIFICATIONS.md`.

## Required first checks

Run read-only checks first:

```bash
pwd
git branch --show-current
git status --short
git remote -v
gh --version
gh auth status
gh repo view ntua-el21026/NTUA-saasPlug --json nameWithOwner,viewerPermission,hasIssuesEnabled,url,isPrivate,defaultBranchRef
gh issue list --repo ntua-el21026/NTUA-saasPlug --limit 1
gh api repos/ntua-el21026/NTUA-saasPlug/labels?per_page=1
gh api repos/ntua-el21026/NTUA-saasPlug/milestones?per_page=1
gh project list --owner ntua-el21026 --limit 10
```

If any GitHub command fails because of missing authentication, missing scope, timeout, or unavailable network, stop GitHub mutations and report the failure clearly.

Do not create Markdown fallback project-management artifacts.

## Allowed repository file changes

You may create or update only these files:

```text
AGENTS.md
docs/ai/README.md
docs/ai/prompts/README.md
docs/ai/codex-runs/README.md
docs/ai/codex-runs/_template.md
docs/ai/prompts/prompt_01_repo_foundation.md
docs/ai/prompt-log.md
docs/ai/codex-runs/00B-logging-and-github-setup.md
```

You may also create:

```text
docs/ai/prompts/prompt_00b_logging_and_github_setup.md
```

only if practical, by saving the exact prompt text used for this run.

Do not modify application/source/runtime files.

Do not modify:

```text
docs/specs/SPECIFICATIONS.md
docs/assignment/
docs/lectures/
docs/diagrams/intermediate/
docs/diagrams/final/
```

unless the prompt-log/run-log update requires a reference only.

## Required AI logging workflow update

Update the AI logging documentation so that every future Codex run clearly distinguishes:

1. **Invocation Prompt**
   The exact text pasted into Codex by the user.

2. **Canonical Task Prompt**
   The version-controlled `.md` prompt file under `docs/ai/prompts/`, when one is used.

The required behavior is:

* `docs/ai/prompts/*.md` files are canonical task prompts.
* The user may invoke them with a short instruction such as:

```text
Read and execute docs/ai/prompts/prompt_01_repo_foundation.md.
Follow AGENTS.md and docs/specs/SPECIFICATIONS.md.
Update docs/ai/codex-runs/001-repo-foundation.md and docs/ai/prompt-log.md.
```

* The exact short instruction is the invocation prompt.
* The `.md` file is the canonical task prompt.
* The run report must record both.
* Where practical, the run report should copy the full canonical task prompt content.
* If the full canonical prompt content is not copied, the run report must record the file path and explain why.

## Required updates by file

### 1. `docs/ai/codex-runs/_template.md`

Update the template so it includes these explicit sections:

```text
1. Run Metadata
2. Invocation Prompt
3. Canonical Task Prompt
4. Canonical Task Prompt Content
5. Goal
6. Canonical Sources Read
7. Files Changed
8. Commands Run
9. Implementation / Audit Summary
10. Tests and Checks
11. Limitations, Warnings, and Blockers
12. GitHub Project / Issue / Milestone Actions
13. Final Status
14. Next Recommended Action
```

The template must explain what each section should contain.

### 2. `docs/ai/prompts/README.md`

Update it to explain the prompt-file workflow:

```text
short invocation prompt -> Codex reads canonical prompt file -> Codex executes task -> Codex writes run report -> Codex updates prompt-log
```

It must also list the planned prompt sequence from audit/00B through prompt 14.

### 3. `docs/ai/prompt-log.md`

Update it so the run index includes columns:

```text
Run ID
Date
Invocation Type
Canonical Prompt File
Purpose
Status
Run Report
```

Preserve the existing audit run entry for run `000`. Add or update an entry for this run:

```text
00B
Logging workflow and GitHub project setup
docs/ai/codex-runs/00B-logging-and-github-setup.md
```

Add or preserve the pending entry for Prompt 01:

```text
001
docs/ai/prompts/prompt_01_repo_foundation.md
Repository foundation
docs/ai/codex-runs/001-repo-foundation.md
```

### 4. `docs/ai/README.md`

Update it to explain the purpose of `docs/ai/`, the manual AI documentation fallback, and the distinction between invocation prompt and canonical task prompt.

### 5. `docs/ai/codex-runs/README.md`

Update it to explain run report naming, the required template, and the invocation/canonical prompt distinction.

### 6. `docs/ai/prompts/prompt_01_repo_foundation.md`

Update the logging section so Prompt 01 explicitly requires Codex to record:

* the exact invocation prompt pasted by the user;
* the canonical task prompt file path;
* the full content of the canonical prompt file where practical;
* visible model/settings/sandbox/approval/network information;
* files changed;
* commands run;
* checks/tests run;
* warnings/blockers;
* final status.

Do not change the foundation scope of Prompt 01.

### 7. `AGENTS.md`

Add or update a global section titled:

```text
AI Run Logging Policy
```

It must state that every Codex run must update:

```text
docs/ai/prompt-log.md
docs/ai/codex-runs/<run-id>-<run-name>.md
```

unless a prompt explicitly forbids writes.

It must define the distinction between invocation prompt and canonical task prompt.

## GitHub project-management setup

After the read-only GitHub checks pass, attempt direct GitHub setup for:

```text
ntua-el21026/NTUA-saasPlug
```

Do not create Markdown fallback project-management artifacts.

### Required labels

Create missing labels if they do not already exist:

```text
service:auth
service:provider-registry
service:provider
service:catalog
service:status
service:reservation
service:analytics
service:billing
frontend
docker
docs
uml
tests
github-project
bug
enhancement
blocked
```

If a label already exists, do not fail. Report it as existing.

### Required milestones

Create missing milestones if they do not already exist:

```text
Sprint 1 - Architecture & Foundations
Sprint 2 - Core SaaS Flows
Sprint 3 - Dashboards & Delivery
```

If a milestone already exists, do not fail. Report it as existing.

### Required GitHub Project

Create a GitHub Project if one does not already exist with this title:

```text
saasPlug Implementation
```

Owner:

```text
ntua-el21026
```

If a project with this exact title already exists, reuse it and report its number/URL.

If GitHub Project creation fails because of missing `project` scope, permissions, CLI limitations, or network issues, stop project mutations and report:

* exact failing command;
* exact error;
* likely cause;
* what the user must do manually.

Do not create Markdown fallback project-management files.

### Required issues

If GitHub issue creation works, create missing implementation-tracking issues for the staged prompt plan.

Use these issue titles:

```text
Prompt 01 - Repository foundation
Prompt 02 - Docker Compose and Nginx gateway
Prompt 03 - Auth service
Prompt 04 - Provider registry service
Prompt 05 - red/green/blue provider services
Prompt 06 - Catalog service
Prompt 07 - Status service
Prompt 08 - Reservation service
Prompt 09 - RabbitMQ event infrastructure
Prompt 10 - Analytics service
Prompt 11 - Billing service
Prompt 12 - EV frontend flows
Prompt 13 - Provider and operator dashboards
Prompt 14 - Final docs and UML finalization
```

Assign them to milestones:

```text
Sprint 1 - Architecture & Foundations:
- Prompt 01
- Prompt 02
- Prompt 03
- Prompt 04

Sprint 2 - Core SaaS Flows:
- Prompt 05
- Prompt 06
- Prompt 07
- Prompt 08
- Prompt 09

Sprint 3 - Dashboards & Delivery:
- Prompt 10
- Prompt 11
- Prompt 12
- Prompt 13
- Prompt 14
```

Apply relevant labels.

If adding issues to the GitHub Project is supported by the available `gh` commands/API, add them to the `saasPlug Implementation` project. If not supported, report the limitation clearly. Do not create fallback Markdown artifacts.

## Remote repository correction

Check the current local remote.

If `origin` does not point to the canonical repository `ntua-el21026/NTUA-saasPlug`, and the canonical repository is accessible, update it to the canonical remote.

Preferred HTTPS remote:

```text
https://github.com/ntua-el21026/NTUA-saasPlug.git
```

Only change the remote if the mismatch is clear. Report before/after values.

## Run report for this run

Create or update:

```text
docs/ai/codex-runs/00B-logging-and-github-setup.md
```

The run report must follow:

```text
docs/ai/codex-runs/_template.md
```

It must include:

* exact invocation prompt pasted by the user;
* canonical task prompt file path if `docs/ai/prompts/prompt_00b_logging_and_github_setup.md` was created;
* full prompt content where practical;
* visible model/settings/sandbox/approval/network information;
* git branch and status before/after;
* files changed;
* commands run;
* GitHub commands attempted;
* GitHub labels/milestones/project/issues created or reused;
* failures and warnings;
* final status;
* next recommended action.

## Checks to run after file changes

Run:

```bash
git status --short
git diff -- AGENTS.md docs/ai/README.md docs/ai/prompts/README.md docs/ai/codex-runs/README.md docs/ai/codex-runs/_template.md docs/ai/prompts/prompt_01_repo_foundation.md docs/ai/prompt-log.md docs/ai/codex-runs/00B-logging-and-github-setup.md
test -f AGENTS.md
test -f docs/specs/SPECIFICATIONS.md
test -f docs/ai/prompts/README.md
test -f docs/ai/codex-runs/_template.md
test -f docs/ai/prompt-log.md
test -f docs/ai/prompts/prompt_01_repo_foundation.md
```

Do not run dependency installation.

Do not run Docker.

## Final response format

Your final response must include:

1. Final status:

   * `COMPLETED`
   * `COMPLETED_WITH_WARNINGS`
   * `FAILED`
2. Summary of documentation/logging changes.
3. GitHub access result.
4. GitHub labels/milestones/project/issues created or reused.
5. Whether local git remote was changed.
6. Files changed.
7. Commands run and results.
8. Warnings/blockers.
9. Confirmation that no application/source/Docker runtime/business logic was implemented.
10. Exact next recommended action.
