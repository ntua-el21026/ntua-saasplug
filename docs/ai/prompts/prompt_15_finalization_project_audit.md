You are working in the GitHub repository:

ntua-el21026/NTUA-saasPlug

Project name:

saasPlug

Course context:

This is an NTUA ECE semester project for the course “Technologies of Software Services / Τεχνολογίες Υπηρεσιών Λογισμικού”. saasPlug is a SaaS web application for EV charging-point discovery and reservation. EV users search charging points from multiple providers and reserve them. Charging infrastructure providers expose APIs to saasPlug, view analytics, receive invoices, pay issued invoices through a mock payment flow, and export usage logs. The saasPlug operator manages global analytics, providers, pricing rules, sync, and invoices.

Repository content rule:

All repository files, documentation, code, comments, README files, Codex prompts, AI logs, GitHub issue titles, GitHub issue bodies, GitHub Project names, and GitHub Project item names must remain in English.

Do not use Greek in repository artifacts or GitHub project-management artifacts.

Do not use Vercel.
Do not add deployment or hosting workflows.
Do not implement application features in this prompt.
Do not change backend business logic.
Do not change frontend business logic.
Do not change architecture.
Do not add secrets.
Do not create `.env`.
Do not print secret values.
Do not create fallback Markdown project-management artifacts such as `docs/project-management`.
Use GitHub Projects/issues directly if the available GitHub CLI/API permissions allow it.
If GitHub Project operations are unavailable, create/read issues if possible, and clearly report the unavailable project operations. Do not fabricate success.

Canonical repository sources:

Treat these as authoritative:

- AGENTS.md
- README.md
- docs/specs/SPECIFICATIONS.md
- docs/ai/prompt-log.md
- docs/ai/codex-runs/
- docs/ai/prompts/README.md
- docs/final-verification.md
- docs/submission-checklist.md
- docs/architecture-summary.md
- docs/diagrams/final/

If anything conflicts with `AGENTS.md` or `docs/specs/SPECIFICATIONS.md`, follow `AGENTS.md` and `docs/specs/SPECIFICATIONS.md`.

Important current state:

The first implementation project was completed through staged prompts/issues #1 through #14.

Expected historical issue/run mapping:

- Issue #1 / Prompt 01 - Repository foundation
- Issue #2 / Prompt 02 - Docker Compose and Nginx gateway
- Issue #3 / Prompt 03 - Auth service
- Issue #4 / Prompt 04 - Provider registry service
- Issue #5 / Prompt 05 - red/green/blue provider services
- Issue #6 / Prompt 06 - Catalog service
- Issue #7 / Prompt 07 - Status service
- Issue #8 / Prompt 08 - Reservation service
- Issue #9 / Prompt 09 - RabbitMQ event infrastructure
- Issue #10 / Prompt 10 - Analytics service
- Issue #11 / Prompt 11 - Billing service
- Issue #12 / Prompt 12 - EV frontend flows
- Issue #13 / Prompt 13 - Provider and operator dashboards
- Issue #14 / Prompt 14 - Final docs and UML finalization

Expected run statuses in `docs/ai/prompt-log.md`:

- 000: completed
- 00B: completed_with_warnings
- 001: completed
- 002: completed
- 003: completed
- 004: completed
- 005: completed
- 006: completed_with_warnings
- 007: completed_with_warnings
- 008: completed
- 009: completed
- 010: completed
- 011: completed
- 012: completed_with_warnings
- 013: completed_with_warnings
- 014: completed_with_warnings

Prompt 14 final verification previously passed:

- frontend tests;
- frontend build;
- shared events tests with `-s` workaround;
- `docker compose config`;
- `docker compose up -d --build`;
- `docker compose ps` with healthy containers;
- gateway health;
- public service health routes;
- authenticated EV smoke;
- authenticated provider-admin smoke;
- authenticated operator smoke;
- Docker cleanup;
- `git diff --check`;
- no `.env`;
- forbidden frontend/source checks;
- README/final docs/diagram presence checks.

Known non-blocking warnings from final inspection:

1. Google OAuth is hook-level/local-MVP only; real token exchange is deferred.
2. Live provider calls require real provider credentials/environment variables.
3. No scheduler/worker container exists; workflows are manually triggered by operator endpoints.
4. Startup table creation is used instead of a complete migration workflow.
5. PlantUML source exists, but local rendering was previously not validated because PlantUML CLI was missing.
6. Browser visual automation / design QA and Figma validation were not previously run.
7. Shared event tests previously required a Python/pytest `-s` workaround due to a local capture issue.

Important environment update:

PlantUML verification tools have now been installed locally with:

```bash
sudo apt install default-jre graphviz plantuml
```

Therefore this audit should attempt actual PlantUML validation/rendering.

Accepted architecture summary:

1. One role-based frontend web app:
   - React + TypeScript + Vite.
   - Located under `apps/frontend`.
   - Browser calls only gateway routes under `/api/...`.
   - No browser calls to internal service ports.
   - No browser calls to external provider APIs.
   - No browser RabbitMQ access.

2. Backend:
   - Python FastAPI microservices.
   - Each service owns its data and its own PostgreSQL container if stateful.

3. Gateway:
   - Nginx reverse proxy/API gateway.
   - Frontend calls only gateway paths.
   - No direct browser access to internal services or provider APIs.

4. Runtime:
   - Docker Compose.

5. Databases:
   - PostgreSQL only.
   - Separate PostgreSQL container per stateful service.
   - No MongoDB.

6. Messaging:
   - RabbitMQ topic exchange.
   - RabbitMQ is used for background/event flows:
     - provider sync;
     - catalog aggregation/import events;
     - analytics aggregation;
     - billing propagation.

   - RabbitMQ is not used for:
     - login;
     - map search;
     - point details;
     - status lookup;
     - the live reservation provider call;
     - direct frontend actions.

7. No dedicated orchestrator service:
   - Use local orchestration inside responsible services.
   - Use event choreography for asynchronous propagation.
   - No saga/distributed transaction implementation for MVP.

Canonical service set:

- auth-service
- provider-registry-service
- red-provider-service
- green-provider-service
- blue-provider-service
- catalog-service
- status-service
- reservation-service
- analytics-service
- billing-service

Your task in this prompt:

This is Phase A of the new finalization process.

Perform exactly these high-level actions:

1. Close the completed current GitHub Project if possible.
2. Create a new GitHub Project for finalization/hardening if possible.
3. Create proper GitHub issues for the new project, ordered by the planned sequence:
   - A. Audit the repo for all implementation points 1-14.
   - B. Connect real environment variables and verify real functionality.
   - C. Resolve documented warnings 1-7, including adding scheduler/worker support.
   - D. Add proper tests throughout the app, ideally under a root-level `tests/` directory.

4. Execute Phase A only: audit the repo for all implementation points 1-14 and rerun verification checks.
5. Document this prompt and run in the existing AI log system.

Do not start Phase B, Phase C, or Phase D implementation in this prompt.
