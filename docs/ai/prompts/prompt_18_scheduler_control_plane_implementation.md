# Prompt 18 - Scheduler / control-plane implementation

You are working in:

`ntua-el21026/NTUA-saasPlug`

Task type:

`PHASE C - SCHEDULER / CONTROL-PLANE IMPLEMENTATION`

## Goal

Implement the accepted hybrid scheduler/control-plane architecture for saasPlug.

This is a full Phase C implementation prompt. Complete the scheduler/control-plane feature end-to-end, including backend service, scheduler database, Docker Compose integration, Nginx route, service-owned internal job endpoints, operator APIs/UI, documentation, AI logs, tests, and verification.

Do not start Phase D root-level broad test-suite work.

Do not implement deployment or Vercel.

Do not commit `.env`.

Do not print secrets.

Do not expose provider API keys, JWT secrets, Google secrets, RabbitMQ passwords, database passwords, access tokens, or refresh tokens.

All repository content must remain in English.

## Canonical context

Read first:

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/016-live-env-verification.md`
- `docs/ai/codex-runs/017-scheduler-design.md`
- `docker-compose.yml`
- `deploy/nginx/default.conf`
- `.env.example`

## Important previous state

- Phase A completed.
- Phase B passed with warnings.
- Live provider credentials and Bearer auth now work.
- Provider API live read-only checks passed:
  - redPlug list/detail: 200
  - greenPlug list/detail: 200
  - bluePlug list/status: 200

- Phase B issue is closed/done.
- Phase C scheduler design exists in `docs/ai/codex-runs/017-scheduler-design.md`.

## Accepted Phase C architecture

Implement the hybrid design:

- Add `scheduler-service` as a lightweight central control-plane.
- Add `scheduler-postgres` as scheduler-owned database.
- Scheduler stores only scheduler metadata:
  - job definitions;
  - run history;
  - run status;
  - safe summaries;
  - locks/metadata.

- Scheduler does not contain business logic.
- Scheduler does not read or write any other service database.
- Actual job execution remains service-owned.
- Scheduler triggers responsible services through Docker-internal HTTP endpoints.
- Internal job endpoints require scheduler authentication.
- Live user actions remain synchronous HTTP and must not move to RabbitMQ.
- RabbitMQ remains for background/event propagation only.
- No service may write to another service database.

## Add SPEC amendment

Update canonical documentation to include:

- `scheduler-service`;
- `scheduler-postgres`;
- scheduler/control-plane role;
- internal job endpoints;
- operator scheduler controls;
- no business orchestration and no cross-service DB access.

Minimum files to update for docs/specs:

- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `README.md` if needed
- `docs/final-verification.md`
- `docs/submission-checklist.md`

## AI log requirements

Create:

- `docs/ai/prompts/prompt_18_scheduler_control_plane_implementation.md`
- `docs/ai/codex-runs/018-scheduler-control-plane-implementation.md`

Update:

- `docs/ai/prompt-log.md`

If the GitHub Phase C issue/project item is available:

- move Phase C to In Progress at the start;
- close/move to Done only if the final Phase C validation passes or passes with accepted warnings;
- do not touch Phase D except to mention it as next.

## Implementation requirements

### 1. Add scheduler service

Create:

- `services/scheduler-service/`

Use the project’s existing FastAPI/Python conventions.

The service must include at minimum:

- FastAPI app;
- `/health`;
- operator-protected scheduler APIs;
- scheduler DB configuration;
- SQLAlchemy/SQLModel models or repository layer consistent with existing backend style;
- scheduler loop or background runner;
- HTTP client for internal service calls;
- safe redaction utilities;
- tests.

Suggested scheduler tables:

- `scheduled_jobs`
- `job_runs`
- optional `scheduler_events` if practical

Minimum `scheduled_jobs` fields:

- `id`
- `job_key`
- `display_name`
- `description`
- `target_service`
- `target_method`
- `target_url`
- `schedule_type`: interval / cron / manual
- `interval_seconds`
- `cron_expression`
- `timezone`
- `enabled`
- `request_body`
- `timeout_seconds`
- `max_retries`
- `retry_backoff_seconds`
- `jitter_seconds`
- `max_concurrency`
- `next_run_at`
- `last_run_id`
- `last_status`
- `created_at`
- `updated_at`

Minimum `job_runs` fields:

- `id`
- `job_id`
- `job_key`
- `trigger_type`: scheduled / manual / retry
- `triggered_by_user_id` nullable
- `triggered_by_email` nullable
- `status`: queued / running / succeeded / failed / timed_out / skipped / cancelled
- `scheduled_for`
- `started_at`
- `finished_at`
- `duration_ms`
- `attempt`
- `correlation_id`
- `scheduler_instance_id`
- `target_http_status`
- `response_summary`
- `error_type`
- `error_message`
- `lock_expires_at`
- `created_at`

### 2. Add scheduler environment variables

Add placeholders/defaults to `.env.example` and `docker-compose.yml`.

Required variables:

- `SCHEDULER_DATABASE_URL`
- `SCHEDULER_TICK_SECONDS`
- `SCHEDULER_MAX_CONCURRENT_JOBS`
- `SCHEDULER_INSTANCE_ID`
- `SCHEDULER_INTERNAL_TOKEN`
- `SCHEDULER_HTTP_TIMEOUT_SECONDS`
- `CATALOG_SERVICE_URL`
- `ANALYTICS_SERVICE_URL`
- `BILLING_SERVICE_URL`
- `RESERVATION_SERVICE_URL`

Use safe placeholders only. Do not add real secrets.

If `.env` does not contain `SCHEDULER_INTERNAL_TOKEN`, do not modify `.env`. Use Compose defaults only if safe for local dev, and document that real/local hardening should set it in `.env`.

### 3. Add Docker Compose integration

Add:

- `scheduler-service`
- `scheduler-postgres`
- scheduler volume
- healthcheck
- dependency wiring

Preserve:

- one PostgreSQL container per stateful service;
- existing service containers;
- existing RabbitMQ usage;
- existing gateway behavior.

### 4. Add Nginx gateway route

Expose only operator scheduler APIs through gateway:

- `/api/scheduler/*`

Do not expose service-owned `/internal/jobs/*` routes through Nginx.

### 5. Add scheduler APIs

Expose operator-only APIs:

- `GET /api/scheduler/jobs`
- `GET /api/scheduler/jobs/{job_key}`
- `PATCH /api/scheduler/jobs/{job_key}`
- `POST /api/scheduler/jobs/{job_key}/run`
- `POST /api/scheduler/jobs/{job_key}/pause`
- `POST /api/scheduler/jobs/{job_key}/resume`
- `GET /api/scheduler/runs`
- `GET /api/scheduler/runs/{run_id}`
- `GET /api/scheduler/health`

Access rules:

- OPERATOR only.
- EV_USER and PROVIDER_ADMIN must be denied.
- Validate the same JWT style used by other services.
- Do not log tokens.

### 6. Seed initial scheduler jobs

Seed deterministic default job definitions:

- `catalog.import.all`
  - target: catalog-service
  - endpoint: `POST /internal/jobs/catalog/imports/all`
  - every 15 minutes
  - timeout 180s
  - retries 1

- `analytics.consume-events`
  - target: analytics-service
  - endpoint: `POST /internal/jobs/events/consume`
  - every 60 seconds
  - timeout 30s
  - retries 2

- `analytics.refresh-aggregates`
  - target: analytics-service
  - endpoint: `POST /internal/jobs/aggregates/refresh`
  - every 5 minutes
  - timeout 90s
  - retries 1

- `billing.drain-events`
  - target: billing-service
  - endpoint: `POST /internal/jobs/events/drain`
  - every 60 seconds
  - timeout 30s
  - retries 2

- `billing.publish-outbox`
  - target: billing-service
  - endpoint: `POST /internal/jobs/outbox/publish-pending`
  - every 60 seconds
  - timeout 30s
  - retries 2

- `reservation.publish-outbox`
  - target: reservation-service
  - endpoint: `POST /internal/jobs/outbox/publish-pending`
  - every 60 seconds
  - timeout 30s
  - retries 2

- `billing.prepare-invoices`
  - target: billing-service
  - endpoint: `POST /internal/jobs/invoices/prepare`
  - daily at 02:30 Europe/Athens
  - timeout 180s
  - retries 1
  - must prepare candidates/summaries only; operator still issues invoices explicitly.

Also seed manual-only jobs:

- `catalog.import.red`
- `catalog.import.green`
- `catalog.import.blue`
- `analytics.refresh-aggregates.manual`
- `billing.drain-events.manual`

### 7. Add internal service-owned job endpoints

Add internal endpoints to responsible services.

All internal endpoints must:

- require `X-Scheduler-Token`;
- require `X-Job-Run-Id`;
- accept optional `X-Correlation-Id`;
- return compact safe summaries only;
- not return raw provider response bodies;
- not log secrets;
- be idempotent for repeated `X-Job-Run-Id` where practical;
- remain unavailable directly from frontend.

Required endpoints:

catalog-service:

- `POST /internal/jobs/catalog/imports/all`
- `POST /internal/jobs/catalog/imports/providers/{provider_code}`
- `GET /internal/jobs/catalog/freshness`

analytics-service:

- `POST /internal/jobs/events/consume`
- `POST /internal/jobs/aggregates/refresh`
- `GET /internal/jobs/freshness`

billing-service:

- `POST /internal/jobs/events/drain`
- `POST /internal/jobs/outbox/publish-pending`
- `POST /internal/jobs/invoices/prepare`
- `GET /internal/jobs/freshness`

reservation-service:

- `POST /internal/jobs/outbox/publish-pending`
- `GET /internal/jobs/freshness`

Do not add provider-service scheduled endpoints unless required by existing code. For the first implementation, catalog-service should own provider import orchestration and call provider services through existing internal paths.

### 8. Scheduler execution behavior

Implement:

- due-job selection;
- next-run calculation;
- interval jobs;
- cron/daily job support if practical;
- manual run creation;
- pause/resume;
- retry with bounded backoff;
- per-job timeout;
- `max_concurrency=1` per job key;
- safe run summaries;
- lock expiry / crashed-run recovery if practical;
- no duplicate overlapping runs.

If cron support would be too large, implement interval/manual jobs first and represent daily invoice preparation with a simple daily calculation. Document any limitation clearly.

### 9. Frontend operator UI

Update the existing operator UI.

Add or extend pages/components under the operator area:

- scheduler health card;
- scheduled jobs list;
- job status labels;
- last run / next run;
- manual run button;
- pause/resume buttons with confirmation;
- run history table;
- safe run detail view or expandable row.

Recommended placement:

- extend `/operator/system` with scheduler health and recent failed jobs;
- extend `/operator/sync` with manual job controls and run history.

Frontend rules:

- browser calls only gateway `/api/...` routes;
- no direct internal service URLs;
- no RabbitMQ/browser access;
- no provider API calls from browser.

### 10. Tests

Add/update focused tests.

Required:

scheduler-service tests:

- health;
- operator authorization;
- EV/provider denial;
- job seed existence;
- interval next-run calculation;
- due-job selection;
- manual run creation;
- pause/resume;
- response redaction;
- failed internal call records failed run;
- successful internal call records succeeded run.

Service internal endpoint tests:

- `X-Scheduler-Token` required;
- `X-Job-Run-Id` required;
- safe summary response;
- no secret/raw provider body returned;
- existing service behavior remains passing.

Frontend tests:

- scheduler operator routes/components render;
- EV/provider users cannot access scheduler UI;
- operator can view scheduler cards/list;
- API calls are gateway-relative.

Existing tests must continue to pass.

### 11. Validation commands

Run as many as available, and report unavailable tools clearly.

Required:

```bash
git status --short
git diff --check
docker compose config --quiet
```

Frontend:

```bash
cd apps/frontend
npm run test
npm run build
cd ../..
```

Backend/service tests:

- run scheduler-service tests;
- run touched service tests;
- run existing provider/auth/catalog/reservation/analytics/billing tests as practical.

Shared events:

```bash
PYTHONPATH=packages/events python -m pytest packages/events/tests -q
```

If the known Python/pytest capture issue occurs, retry:

```bash
PYTHONPATH=packages/events python -m pytest packages/events/tests -q -s
```

Docker/runtime:

```bash
docker compose up -d --build
docker compose ps
```

Gateway health:

```bash
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/auth/health
curl -fsS http://localhost:8080/api/providers/health
curl -fsS http://localhost:8080/api/catalog/health
curl -fsS http://localhost:8080/api/status/health
curl -fsS http://localhost:8080/api/reservations/health
curl -fsS http://localhost:8080/api/analytics/health
curl -fsS http://localhost:8080/api/billing/health
curl -fsS http://localhost:8080/api/scheduler/health
```

Authenticated smoke:

- EV login works;
- provider-admin login works;
- operator login works;
- operator can call scheduler API;
- EV and provider-admin cannot call scheduler API.

Scheduler smoke:

- manually trigger `catalog.import.all`;
- manually trigger `analytics.consume-events`;
- manually trigger `analytics.refresh-aggregates`;
- manually trigger `billing.drain-events`;
- manually trigger `reservation.publish-outbox`;
- verify run records and safe summaries;
- verify no raw secrets are stored or printed.

Automatic schedule smoke:

- if feasible, temporarily use short intervals through test/local config only;
- verify at least one scheduled job is picked up automatically;
- restore defaults.

Cleanup:

```bash
docker compose down -v
docker compose ps -a
```

Static checks:

- scan that frontend uses only `/api/...`;
- scan that `/internal/jobs/*` is not exposed through Nginx;
- scan that `.env` is not tracked;
- scan for obvious committed secrets;
- verify `openapi.json` remains untracked unless already tracked intentionally.

### 12. Documentation updates

Update:

- `README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/diagrams/final/*` if diagrams materially change
- `docs/diagrams/final/README.md` if needed

Diagrams:

If architecture/deployment/component/sequence diagrams need scheduler updates, update PlantUML source and validate:

```bash
plantuml -checkonly docs/diagrams/final/*.puml
```

If `-checkonly` is unsupported, render as validation and report the limitation.

### 13. GitHub issue/project handling

Find the Phase C scheduler issue by title/project context. Do not rely blindly on issue number.

At the start:

- move Phase C scheduler issue to In Progress if possible.

At the end:

- close/move to Done only if Phase C validation passes or passes with accepted warnings.

Do not close or modify Phase D issue.

### 14. Allowed changes

Allowed:

- scheduler-service source/tests;
- touched service internal job endpoints/tests;
- frontend operator scheduler UI/tests;
- Docker Compose;
- Nginx gateway;
- `.env.example`;
- documentation/specs/diagrams;
- AI prompt/run logs.

Not allowed:

- `.env`;
- deployment/Vercel;
- broad root-level Phase D tests;
- unrelated refactors;
- moving live user actions to RabbitMQ;
- cross-service DB writes;
- provider API secrets in docs/logs;
- Greek repository content.

## Final response format

Return exactly:

```markdown
## Status

PASS / PASS_WITH_WARNINGS / FAIL

## Architecture implemented

Briefly describe scheduler-service, scheduler-postgres, internal job endpoints, and operator UI.

## Jobs implemented

Table of job keys, schedule/manual, target service, endpoint.

## Validation

Commands run and pass/fail/skipped/unavailable status.

## Files changed

Exact file list grouped by area.

## Warnings

Only real warnings.

## Blockers

No blockers, or precise blocker list.

## GitHub issue/project status

What happened to the Phase C issue/project item.

## Next phase

State whether Phase D should start next and what remains.
```

Important: because this is large scope, `PASS_WITH_WARNINGS` is acceptable only if the warnings are tooling/non-critical, not if a core component is missing, such as `scheduler-service`, `scheduler-postgres`, internal endpoints, or operator scheduler API.
