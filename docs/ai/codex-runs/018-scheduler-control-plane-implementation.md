# Codex Run 018 - Scheduler Control-Plane Implementation

## Invocation Prompt

The user requested execution of `docs/ai/prompts/prompt_18_scheduler_control_plane_implementation.md` for Phase C only, with strict constraints: add scheduler/control-plane support, do not start Phase D, do not deploy, do not touch `.env`, do not print secrets, do not expose credentials, do not move live user actions to RabbitMQ, do not introduce cross-service database access, and keep repository content in English.

## Canonical Task Prompt

Canonical prompt file:

`docs/ai/prompts/prompt_18_scheduler_control_plane_implementation.md`

The full canonical prompt remains in the versioned prompt file rather than being duplicated here because it is long and already committed as the canonical task artifact for this run.

## Goal

Implement the accepted hybrid scheduler/control-plane architecture:

- `scheduler-service` as a central control plane;
- `scheduler-postgres` for scheduler-owned metadata;
- service-owned internal HTTP job endpoints protected by `X-Scheduler-Token`;
- operator scheduler APIs and UI;
- Docker Compose, Nginx, documentation, diagrams, tests, and GitHub issue/project updates.

## Implementation Summary

- Added `services/scheduler-service` with FastAPI, SQLAlchemy models, scheduler metadata persistence, seeded jobs, scheduler loop, internal HTTP client, operator-only scheduler APIs, redacted response summaries, and tests.
- Added `scheduler-postgres`, scheduler environment variables, Compose wiring, and Nginx `/api/scheduler/*` routing.
- Added internal service-owned job endpoints to catalog, analytics, billing, and reservation services. These endpoints validate `X-Scheduler-Token` and require `X-Job-Run-Id`.
- Added Phase C hardening on 2026-06-14 so Nginx returns `404` for `/api/catalog/internal/`, `/api/analytics/internal/`, `/api/billing/internal/`, and `/api/reservations/internal/` before the broad service proxy routes. `404` is used consistently so internal route existence is not disclosed at the gateway.
- Extended the operator Sync page with scheduler jobs, manual run, pause/resume, and run history. Extended the operator System page with scheduler health and run history.
- Updated specs, architecture summary, README files, final verification, submission checklist, and changed final PlantUML diagrams.
- Moved GitHub Phase C issue #18 to In Progress at the start, then closed it and moved its Project #2 item to Done after validation passed. Phase D issue #17 remained Todo.

## Files Changed

### Scheduler service

- `services/scheduler-service/README.md`
- `services/scheduler-service/Dockerfile`
- `services/scheduler-service/requirements.txt`
- `services/scheduler-service/app/__init__.py`
- `services/scheduler-service/app/client.py`
- `services/scheduler-service/app/config.py`
- `services/scheduler-service/app/database.py`
- `services/scheduler-service/app/executor.py`
- `services/scheduler-service/app/jobs.py`
- `services/scheduler-service/app/main.py`
- `services/scheduler-service/app/models.py`
- `services/scheduler-service/app/routes.py`
- `services/scheduler-service/app/runner.py`
- `services/scheduler-service/app/schemas.py`
- `services/scheduler-service/app/security.py`
- `services/scheduler-service/tests/test_scheduler_service_api.py`

### Backend services

- `services/catalog-service/app/config.py`
- `services/catalog-service/app/routes.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `services/analytics-service/app/config.py`
- `services/analytics-service/app/routes.py`
- `services/analytics-service/tests/test_analytics_service_api.py`
- `services/billing-service/app/config.py`
- `services/billing-service/app/routes.py`
- `services/billing-service/tests/test_billing_service_api.py`
- `services/reservation-service/app/config.py`
- `services/reservation-service/app/routes.py`
- `services/reservation-service/tests/test_reservation_service_api.py`

### Frontend

- `apps/frontend/README.md`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/test/admin-routing.test.tsx`

### Runtime and gateway

- `.env.example`
- `docker-compose.yml`
- `deploy/README.md`
- `deploy/nginx/README.md`
- `deploy/nginx/default.conf`

### Documentation and diagrams

- `README.md`
- `services/README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/diagrams/final/component.puml`
- `docs/diagrams/final/deployment.puml`
- `docs/diagrams/final/data-model.puml`
- `docs/diagrams/final/sequence-provider-sync-catalog-import.puml`

### AI logs

- `docs/ai/prompts/prompt_18_scheduler_control_plane_implementation.md`
- `docs/ai/codex-runs/018-scheduler-control-plane-implementation.md`
- `docs/ai/prompt-log.md`

## Tests and Verification

| Check | Result |
|---|---|
| `docker compose config --quiet` | Pass |
| `docker compose run --build --rm --no-deps scheduler-service pytest -q` | Pass, 7 tests |
| `docker compose run --build --rm --no-deps catalog-service pytest -q` | Pass, 14 tests |
| `docker compose run --build --rm --no-deps analytics-service pytest -q` | Pass, 15 tests |
| `docker compose run --build --rm --no-deps billing-service pytest -q` | Pass, 20 tests |
| `docker compose run --build --rm --no-deps reservation-service pytest -q` | Pass, 21 tests |
| `docker compose run --build --rm --no-deps frontend npm test` | Pass, 3 files / 8 tests |
| `docker compose run --build --rm --no-deps frontend npm run build` | Pass |
| Shared event package tests through analytics-service image | Pass, 10 tests |
| `plantuml -checkonly docs/diagrams/final/*.puml` | Pass |
| PlantUML render to `/tmp/saasplug-phase-c-plantuml-render` | Pass |
| `docker compose up -d --build` | Pass |
| `docker compose ps` | Pass, all containers healthy |
| Gateway health checks including `/api/scheduler/health` | Pass |
| Authenticated EV smoke | Pass |
| Authenticated provider-admin smoke | Pass |
| Authenticated operator smoke | Pass |
| Scheduler manual run smoke for `billing.prepare-invoices` | Pass, succeeded with target HTTP 200 |
| Frontend application-source forbidden-pattern check | Pass |
| Nginx internal job exposure check | Pass |
| Phase C hardening gateway block smoke | Pass, `/api/catalog/internal/...`, `/api/analytics/internal/...`, `/api/billing/internal/...`, and `/api/reservations/internal/...` returned 404 |
| Phase C hardening scheduler health smoke | Pass, `/api/scheduler/health` returned 200 |
| Phase C hardening scheduler manual-run smoke | Pass, `billing.prepare-invoices` succeeded with target HTTP 200 through Docker-internal service URLs |
| `docker compose exec -T nginx-gateway nginx -t` | Pass |
| `docker compose down -v` and `docker compose ps -a` | Pass |
| `git diff --check` | Pass |

## Results

Phase C passed. Core components are present: `scheduler-service`,
`scheduler-postgres`, scheduler metadata persistence, internal job endpoints,
operator scheduler APIs, operator UI, Compose and Nginx integration, focused
tests, documentation, and diagrams.

## Limitations and Warnings

- Automatic schedule smoke with shortened intervals was not run; scheduler due-job selection is covered by service tests and normal startup/manual smoke.
- Full Phase D broad test-suite expansion was not started.
- Browser visual QA was not performed as part of this backend/control-plane phase.
- `.env` was not read beyond safe in-memory demo-password use for authenticated smoke, was not printed, and was not modified.

## Conformance Notes

The implementation conforms to `docs/specs/SPECIFICATIONS.md` after the Phase C amendment:

- no cross-service database access;
- no scheduler-owned business logic;
- no live user actions moved to RabbitMQ;
- service-owned execution remains in catalog, analytics, billing, and reservation services;
- frontend calls only gateway `/api/...` routes.

## GitHub Notes

- Phase C issue #18 was moved to In Progress at the start.
- After validation passed, issue #18 was closed and its Project #2 item was moved to Done.
- Phase D issue #17 was verified still Todo and was not modified.
