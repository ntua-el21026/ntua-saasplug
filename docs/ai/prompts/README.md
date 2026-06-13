# Codex Prompt Pack

This directory contains the staged Codex prompts used to implement the saasPlug project.

The prompt pack keeps implementation deterministic, reviewable, and aligned with `AGENTS.md` and `docs/specs/SPECIFICATIONS.md`. Do not ask Codex to implement the full system in one run.

## Prompt-File Workflow

The standard workflow is:

```text
short invocation prompt -> Codex reads canonical prompt file -> Codex executes task -> Codex writes run report -> Codex updates prompt-log
```

The short instruction pasted into Codex is the **Invocation Prompt**.

The `.md` file under this directory is the **Canonical Task Prompt**.

Example invocation:

```text
Read and execute docs/ai/prompts/prompt_01_repo_foundation.md.
Follow AGENTS.md and docs/specs/SPECIFICATIONS.md.
Update docs/ai/codex-runs/001-repo-foundation.md and docs/ai/prompt-log.md.
```

The run report must record both the invocation prompt and the canonical task prompt file path. It should copy the full canonical prompt content where practical.

## Canonical Inputs

Every Codex run must treat the following files as mandatory context:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. The current prompt file under `docs/ai/prompts/`, when one is used
4. Relevant service/package README files, if they already exist
5. Relevant provider OpenAPI YAML files when working on provider adapters

If any mandatory file is missing, Codex must report it before proceeding, unless the prompt explicitly asks Codex to create it.

## Execution Rules

1. Run prompts sequentially.
2. Do not start the next prompt until the previous Codex output has been reviewed.
3. Do not change architecture, service names, database topology, event names, or accepted specifications unless the user explicitly approves a SPEC amendment.
4. Do not add unrequested frameworks, services, databases, queues, infrastructure, or dashboards.
5. Keep all repository content in English.
6. Never commit real secrets or `.env` files.
7. Keep `.env.example` safe and placeholder-only.
8. Keep final diagrams under `docs/diagrams/final/`.
9. Keep intermediate or historical diagrams outside `docs/diagrams/final/`.
10. Create or update README files in every major folder created by the prompt.
11. Create or update a Codex run log for every run.
12. Update `docs/ai/prompt-log.md` after every run.
13. If GitHub CLI/API project-management actions are requested and fail, report the failure clearly. Do not create fallback Markdown project-management substitutes unless explicitly requested.

## Planned Prompt Sequence

| Run | File | Purpose |
|---:|---|---|
| 000 | direct audit prompt | Repository/spec/course-source/GitHub readiness audit |
| 00B | `prompt_00b_logging_and_github_setup.md` | AI logging workflow update and GitHub project setup |
| 01 | `prompt_01_repo_foundation.md` | Repository foundation, documentation structure, README scaffolding, `.env.example`, AI log structure |
| 02 | `prompt_02_docker_gateway.md` | Docker Compose baseline, Nginx gateway, service/database container skeletons, healthchecks |
| 03 | `prompt_03_auth_service.md` | `auth-service`, JWT, email/password login, Google OAuth hooks, role model, seed users |
| 04 | `prompt_04_provider_registry_service.md` | `provider-registry-service`, provider metadata/API config, seed providers |
| 05 | `prompt_05_provider_services.md` | `red-provider-service`, `green-provider-service`, `blue-provider-service`, provider-local DBs, provider normalization |
| 06 | `prompt_06_catalog_service.md` | `catalog-service`, aggregated catalog, viewport/bounds queries, catalog imports |
| 07 | `prompt_07_status_service.md` | `status-service`, 5-minute cache, status checks, fallback policy |
| 08 | `prompt_08_reservation_service.md` | `reservation-service`, synchronous provider reservation flow, reservation events |
| 09 | `prompt_09_rabbitmq_event_infrastructure.md` | RabbitMQ exchange, event envelope, publishers/consumers, idempotency, DLQs |
| 10 | `prompt_10_analytics_service.md` | `analytics-service`, raw events, aggregate tables, provider/operator analytics, CSV export |
| 11 | `prompt_11_billing_service.md` | `billing-service`, pricing rules, charge records, invoices, mock payment |
| 12 | `prompt_12_frontend_ev_flows.md` | EV user frontend: login, map, point details, status, reservations |
| 13 | `prompt_13_provider_operator_dashboards.md` | Provider and operator dashboards, analytics, billing, pricing, sync controls |
| 14 | `prompt_14_final_docs_uml.md` | Final documentation, PlantUML diagrams, README completion, final verification |

Only Prompt 01 is expected to exist before foundation work. Later prompts should be written after reviewing the previous Codex output so they can reference the real repository state.

## Run Log Requirement

For each prompt execution, Codex must create or update:

```text
docs/ai/codex-runs/<run-id>-<short-name>.md
```

Use `docs/ai/codex-runs/_template.md` as the canonical run-log format.

After every run, update:

```text
docs/ai/prompt-log.md
```
