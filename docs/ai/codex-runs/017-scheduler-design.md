# Codex Run 017 - Scheduler control-plane design

Date: 2026-06-13

Canonical prompt: `docs/ai/prompts/prompt_17_scheduler_design.md`

Phase: C design only

## Result

`COMPLETED`

No application source code was modified. This run only records the proposed
Phase C scheduler/control-plane design in AI-log artifacts.

## Canonical constraints

The design follows `AGENTS.md` and `docs/specs/SPECIFICATIONS.md`:

- keep the Dockerized microservice architecture;
- keep one PostgreSQL container per stateful service;
- do not perform cross-service SQL joins or write to another service database;
- keep provider codes `redPlug`, `greenPlug`, and `bluePlug`;
- keep RabbitMQ out of live user actions;
- use background scheduling only for provider/catalog synchronization,
  analytics aggregation, billing preparation/propagation, outbox publishing,
  and manual operator refresh flows;
- keep service-owned business logic in the responsible service, not in a
  central orchestrator.

## 1. Proposed service/container changes

Add a new scheduler control-plane service and database:

| Component | Purpose |
|---|---|
| `scheduler-service` | Stores schedules, claims due jobs, calls internal HTTP job endpoints, records run history, exposes operator-only schedule/run APIs |
| `scheduler-postgres` | Owns scheduler job definitions, run history, locks, and scheduler metadata only |

`scheduler-service` is a control-plane component, not a business orchestrator.
It never reads or writes provider, catalog, analytics, billing, reservation, or
auth service databases. It executes jobs by calling service-owned internal HTTP
endpoints over Docker-internal service URLs.

Recommended runtime shape:

- Python FastAPI service for control APIs and health checks.
- A single in-process scheduler loop in the same container for the local MVP.
- Database-backed due-job claiming with row locks so the design remains safe if
  multiple scheduler replicas are ever run.
- HTTP client with per-job timeout, retry, correlation ID, and idempotency key
  headers.
- Operator-facing routes exposed through `nginx-gateway` as
  `/api/scheduler/*`.
- Service-to-service job endpoints stay Docker-internal and are not exposed
  directly through the gateway.

Recommended environment/config placeholders:

| Variable | Default | Notes |
|---|---|---|
| `SCHEDULER_DATABASE_URL` | `postgresql://saasplug:saasplug@scheduler-postgres:5432/scheduler` | Scheduler-owned DB only |
| `SCHEDULER_TICK_SECONDS` | `10` | How often due jobs are checked |
| `SCHEDULER_MAX_CONCURRENT_JOBS` | `4` | Global local MVP concurrency cap |
| `SCHEDULER_INSTANCE_ID` | generated/container hostname | Used for locks/run ownership |
| `SCHEDULER_INTERNAL_TOKEN` | placeholder in `.env.example` | Sent only to internal job endpoints |
| `SCHEDULER_HTTP_TIMEOUT_SECONDS` | `30` | Default job endpoint timeout |
| `CATALOG_SERVICE_URL` | `http://catalog-service:8000` | Existing Docker-internal service |
| `ANALYTICS_SERVICE_URL` | `http://analytics-service:8000` | Existing Docker-internal service |
| `BILLING_SERVICE_URL` | `http://billing-service:8000` | Existing Docker-internal service |
| `RESERVATION_SERVICE_URL` | `http://reservation-service:8000` | Existing Docker-internal service |

## 2. Exact jobs and intervals

The initial job set should be small, deterministic, and aligned with existing
manual operations.

| Job key | Responsible service | Internal endpoint | Schedule | Timeout | Retries | Notes |
|---|---|---|---|---:|---:|---|
| `catalog.import.all` | `catalog-service` | `POST /internal/jobs/catalog/imports/all` | every 15 minutes | 180s | 1 | Fetches providers through provider services and upserts aggregated catalog |
| `analytics.consume-events` | `analytics-service` | `POST /internal/jobs/events/consume` | every 60 seconds | 30s | 2 | Drains up to configured batch size from `analytics.events` |
| `analytics.refresh-aggregates` | `analytics-service` | `POST /internal/jobs/aggregates/refresh` | every 5 minutes | 90s | 1 | Refreshes provider/operator/point/catalog health aggregate tables |
| `billing.drain-events` | `billing-service` | `POST /internal/jobs/events/drain` | every 60 seconds | 30s | 2 | Drains reservation/billing events into charge records idempotently |
| `billing.publish-outbox` | `billing-service` | `POST /internal/jobs/outbox/publish-pending` | every 60 seconds | 30s | 2 | Publishes pending billing outbox events |
| `reservation.publish-outbox` | `reservation-service` | `POST /internal/jobs/outbox/publish-pending` | every 60 seconds | 30s | 2 | Publishes pending reservation outbox events |
| `billing.prepare-invoices` | `billing-service` | `POST /internal/jobs/invoices/prepare` | daily at 02:30 Europe/Athens | 180s | 1 | Prepares invoice candidates/summaries only; operator still issues invoices |
| `scheduler.prune-run-history` | `scheduler-service` | internal function | daily at 03:30 Europe/Athens | 60s | 0 | Deletes or archives old scheduler run metadata only |

Manual-only job definitions should also exist for operator-triggered demos and
incident recovery:

| Job key | Responsible service | Internal endpoint | Schedule |
|---|---|---|---|
| `catalog.import.red` | `catalog-service` | `POST /internal/jobs/catalog/imports/providers/redPlug` | manual only |
| `catalog.import.green` | `catalog-service` | `POST /internal/jobs/catalog/imports/providers/greenPlug` | manual only |
| `catalog.import.blue` | `catalog-service` | `POST /internal/jobs/catalog/imports/providers/bluePlug` | manual only |
| `analytics.refresh-aggregates.manual` | `analytics-service` | `POST /internal/jobs/aggregates/refresh` | manual only |
| `billing.drain-events.manual` | `billing-service` | `POST /internal/jobs/events/drain` | manual only |

Intervals are deliberately conservative:

- provider/catalog sync every 15 minutes keeps catalog freshness useful without
  hammering external provider APIs;
- event drains every 60 seconds keep analytics/billing near real-time while
  preserving RabbitMQ as asynchronous propagation;
- aggregate refresh every 5 minutes keeps operator/provider dashboards fresh;
- invoice preparation is daily and non-final, preserving operator control over
  invoice issuance.

## 3. Internal endpoints to add per service

All internal job endpoints should:

- require `X-Scheduler-Token`;
- require `X-Job-Run-Id`;
- accept optional `X-Correlation-Id`;
- return a compact JSON summary, not raw payloads;
- be idempotent for the same `X-Job-Run-Id` where practical;
- never expose secrets, provider API keys, JWTs, or raw external provider
  response bodies;
- remain Docker-internal and unavailable directly from the frontend.

### `catalog-service`

| Endpoint | Purpose |
|---|---|
| `POST /internal/jobs/catalog/imports/all` | Service-owned wrapper around all-provider catalog import |
| `POST /internal/jobs/catalog/imports/providers/{provider_code}` | Service-owned wrapper around one provider import |
| `GET /internal/jobs/catalog/freshness` | Compact freshness summary for scheduler/operator diagnostics |

`catalog-service` remains responsible for importing/upserting aggregated
catalog data. It may call provider services internally as it already does for
operator-triggered imports.

### `analytics-service`

| Endpoint | Purpose |
|---|---|
| `POST /internal/jobs/events/consume` | Drain a bounded batch from `analytics.events` |
| `POST /internal/jobs/aggregates/refresh` | Refresh aggregate/cache tables |
| `GET /internal/jobs/freshness` | Return last event ingestion and aggregate timestamps |

`analytics-service` remains responsible for event ingestion, idempotency, and
aggregate computation.

### `billing-service`

| Endpoint | Purpose |
|---|---|
| `POST /internal/jobs/events/drain` | Drain reservation/billing events into billing-owned tables |
| `POST /internal/jobs/outbox/publish-pending` | Publish pending billing outbox events |
| `POST /internal/jobs/invoices/prepare` | Prepare invoice candidates/summaries without issuing official invoices |
| `GET /internal/jobs/freshness` | Return drain/outbox/invoice-preparation freshness |

`billing-service` remains responsible for charge creation, invoice state, and
mock payment state. Operators still issue invoices through the existing
operator-facing billing API.

### `reservation-service`

| Endpoint | Purpose |
|---|---|
| `POST /internal/jobs/outbox/publish-pending` | Publish pending reservation outbox events |
| `GET /internal/jobs/freshness` | Return pending outbox count and last publish timestamp |

`reservation-service` remains responsible for reservation truth and outbox
ownership. The scheduler must not call live reservation provider APIs.

### Provider services

No scheduled provider-service endpoint is required for the first Phase C cut if
`catalog-service` remains the owner of catalog import orchestration and calls
provider services through the existing internal import flow.

Optional future internal endpoints may be added only if catalog import needs to
separate provider-local snapshot refresh from catalog aggregation:

| Endpoint | Purpose |
|---|---|
| `POST /internal/jobs/sync` | Refresh provider-local snapshots for one provider |
| `GET /internal/jobs/freshness` | Return provider-local snapshot freshness |

These optional endpoints should not be scheduled concurrently with
`catalog.import.all` unless duplicate external provider calls are explicitly
controlled.

## 4. Scheduler data model

`scheduler-service` owns all scheduler tables in `scheduler-postgres`.

### `scheduled_jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Stable job definition ID |
| `job_key` | text unique | Example: `catalog.import.all` |
| `display_name` | text | Human-readable label |
| `description` | text nullable | Operator-facing description |
| `target_service` | text | Example: `catalog-service` |
| `target_method` | text | Usually `POST` |
| `target_url` | text | Docker-internal URL path or full internal URL |
| `schedule_type` | enum | `interval`, `cron`, `manual` |
| `interval_seconds` | integer nullable | Required for interval jobs |
| `cron_expression` | text nullable | Required for cron jobs |
| `timezone` | text | Default `Europe/Athens` |
| `enabled` | boolean | Disabled jobs are manual-only unless run explicitly |
| `request_body` | JSON nullable | Static safe body only, no secrets |
| `timeout_seconds` | integer | Per-job HTTP timeout |
| `max_retries` | integer | Retry count after initial attempt |
| `retry_backoff_seconds` | integer | Fixed MVP backoff |
| `jitter_seconds` | integer | Avoid synchronized bursts |
| `max_concurrency` | integer | Usually `1` per job key |
| `next_run_at` | timestamptz nullable | Computed by scheduler |
| `last_run_id` | UUID nullable | Latest run reference |
| `last_status` | enum nullable | Latest terminal status |
| `created_at` | timestamptz | Audit |
| `updated_at` | timestamptz | Audit |

### `job_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Also sent as `X-Job-Run-Id` |
| `job_id` | UUID FK | References `scheduled_jobs.id` |
| `job_key` | text | Denormalized for easier filtering |
| `trigger_type` | enum | `scheduled`, `manual`, `retry` |
| `triggered_by_user_id` | UUID nullable | Set for operator manual runs |
| `triggered_by_email` | text nullable | Snapshot for audit |
| `status` | enum | `queued`, `running`, `succeeded`, `failed`, `timed_out`, `skipped`, `cancelled` |
| `scheduled_for` | timestamptz nullable | Due time |
| `started_at` | timestamptz nullable | Start timestamp |
| `finished_at` | timestamptz nullable | End timestamp |
| `duration_ms` | integer nullable | Runtime |
| `attempt` | integer | Starts at 1 |
| `correlation_id` | UUID | Sent downstream |
| `scheduler_instance_id` | text nullable | Runner identity |
| `target_http_status` | integer nullable | Downstream response status |
| `response_summary` | JSON nullable | Counts/status only; no raw bodies |
| `error_type` | text nullable | Redacted classification |
| `error_message` | text nullable | Redacted safe message |
| `lock_expires_at` | timestamptz nullable | Recovery from crashed runner |
| `created_at` | timestamptz | Audit |

### `scheduler_events`

Optional audit table for operator-visible lifecycle entries:

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Event ID |
| `job_id` | UUID nullable | Related job |
| `run_id` | UUID nullable | Related run |
| `event_type` | text | `job.created`, `job.paused`, `run.started`, etc. |
| `actor_email` | text nullable | Operator or scheduler instance |
| `payload` | JSON nullable | Safe metadata only |
| `created_at` | timestamptz | Audit |

## 5. Operator UI/API impact

Add operator-only scheduler APIs through the gateway:

| Gateway route | Method | Purpose |
|---|---|---|
| `/api/scheduler/jobs` | `GET` | List jobs, enabled state, schedule, next run, last status |
| `/api/scheduler/jobs/{job_key}` | `GET` | Job detail |
| `/api/scheduler/jobs/{job_key}` | `PATCH` | Enable/disable, update interval/cron, timeout, retry fields |
| `/api/scheduler/jobs/{job_key}/run` | `POST` | Manual run request |
| `/api/scheduler/jobs/{job_key}/pause` | `POST` | Pause job |
| `/api/scheduler/jobs/{job_key}/resume` | `POST` | Resume job |
| `/api/scheduler/runs` | `GET` | Filter run history by job, status, date |
| `/api/scheduler/runs/{run_id}` | `GET` | Run details and safe response summary |
| `/api/scheduler/health` | `GET` | Scheduler health and loop freshness |

API access rules:

- `OPERATOR` only.
- Validate the same JWT shape as other services.
- Provider admins and EV users have no scheduler access.
- Manual runs create `job_runs` rows and return run metadata immediately; they
  should not block the UI for long-running work.

Frontend impact:

- Extend `/operator/system` with scheduler health, failed jobs, stale jobs, and
  last/next run cards.
- Extend `/operator/sync` with manual run controls for catalog import and
  aggregate refresh.
- Add a scheduler run-history table with filters and safe response summaries.
- Add pause/resume controls for scheduled jobs with confirmation dialogs.
- Keep status labels consistent: `Queued`, `Running`, `Succeeded`, `Failed`,
  `Timed out`, `Skipped`, `Paused`.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Duplicate job execution | Use `max_concurrency=1` per job, DB row locks, `lock_expires_at`, and downstream `X-Job-Run-Id` idempotency |
| Scheduler outage | Manual service endpoints remain available through operator APIs; due jobs resume from `next_run_at` after restart |
| Long-running provider/catalog imports | Per-job timeout, conservative 15-minute interval, retry once, and no overlapping runs |
| External provider API rate pressure | Schedule catalog import every 15 minutes, add jitter, avoid separate provider direct-sync jobs initially |
| Secret leakage | Never store request headers, tokens, API keys, or raw response bodies in scheduler tables; store redacted summaries only |
| Cross-service data ownership drift | Scheduler stores only job metadata; all business writes remain in responsible service databases |
| Accidental invoice issuance | `billing.prepare-invoices` prepares candidates/summaries only; operator still issues invoices explicitly |
| RabbitMQ misuse | Scheduler may trigger event drains/outbox publishes, but live user flows remain synchronous HTTP and do not use RabbitMQ |
| Internal endpoint exposure | Do not expose `/internal/jobs/*` routes through Nginx; require `X-Scheduler-Token` on Docker-internal calls |
| UI confusion between manual and scheduled runs | Store `trigger_type` and display it clearly in operator run history |

## 7. Affected files for future implementation

This design run changed only AI logs. A future implementation prompt would
likely affect:

| Area | Files/directories |
|---|---|
| Scheduler service | `services/scheduler-service/` |
| Compose/runtime | `docker-compose.yml`, `.env.example` |
| Gateway | `deploy/nginx/default.conf` |
| Catalog internal jobs | `services/catalog-service/app/routes.py`, schemas/security/tests as needed |
| Analytics internal jobs | `services/analytics-service/app/routes.py`, schemas/security/tests as needed |
| Billing internal jobs | `services/billing-service/app/routes.py`, schemas/security/tests as needed |
| Reservation internal jobs | `services/reservation-service/app/routes.py`, schemas/security/tests as needed |
| Optional provider freshness endpoints | `services/red-provider-service/`, `services/green-provider-service/`, `services/blue-provider-service/` |
| Frontend operator UI | `apps/frontend/src/features/operator/`, `apps/frontend/src/lib/api.ts`, frontend DTOs/tests |
| Documentation | `README.md`, `docs/architecture-summary.md`, `docs/final-verification.md`, final PlantUML diagrams if implementation proceeds |
| Tests | scheduler-service tests, touched service tests, frontend tests, Docker/gateway smoke checks |

## 8. Validation plan

Before implementation:

1. Confirm with the user that `scheduler-service` and `scheduler-postgres` are
   accepted as a SPEC amendment to the current canonical service/container
   list.
2. Confirm the initial job set and intervals.
3. Confirm whether `billing.prepare-invoices` should create draft invoice
   records or only refresh invoice-preparation summaries.

During implementation:

1. Run focused scheduler unit tests:
   - interval and cron next-run calculation;
   - due-job selection;
   - locking and lock expiry;
   - retry/backoff behavior;
   - manual run creation;
   - response redaction.
2. Run service endpoint tests:
   - `X-Scheduler-Token` required;
   - `X-Job-Run-Id` required;
   - idempotent repeated job run IDs where practical;
   - no raw secrets or raw provider bodies in responses.
3. Run existing touched service tests.
4. Run frontend operator tests if UI is added.
5. Run static checks:
   - `git diff --check`;
   - scans for committed secrets and `.env`;
   - scans that frontend still uses gateway-only URLs.
6. Run Docker checks:
   - `docker compose config --quiet`;
   - `docker compose up -d --build`;
   - `docker compose ps`;
   - gateway health routes;
   - scheduler health route;
   - operator-authenticated scheduler API smoke.
7. Run controlled scheduler smoke:
   - manually trigger `catalog.import.all`;
   - manually trigger `analytics.consume-events`;
   - manually trigger `analytics.refresh-aggregates`;
   - manually trigger `billing.drain-events`;
   - manually trigger `reservation.publish-outbox`;
   - verify run rows and service-owned side effects without cross-service DB access.
8. Run automatic schedule smoke with temporary short intervals in local test
   configuration, then restore defaults.
9. Run cleanup:
   - `docker compose down -v`;
   - `docker compose ps -a`.

Acceptance criteria:

- scheduler stores only scheduler metadata;
- responsible services own all business execution and data writes;
- no live user action is moved onto RabbitMQ;
- no service writes to another service database;
- operator can inspect, pause/resume, and manually run jobs;
- scheduled jobs execute without duplicate overlapping runs;
- no secrets or raw external provider responses are logged or stored.

## Files changed in this design run

- `docs/ai/prompts/prompt_17_scheduler_design.md`
- `docs/ai/codex-runs/017-scheduler-design.md`
- `docs/ai/prompt-log.md`

