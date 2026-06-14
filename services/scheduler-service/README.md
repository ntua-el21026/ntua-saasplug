# scheduler-service

`scheduler-service` is the saasPlug background-job control plane.

## Responsibility

The service stores job definitions and run history in `scheduler-postgres`,
evaluates due interval/cron jobs, and dispatches manual operator runs. It calls
service-owned internal HTTP job endpoints with `X-Scheduler-Token` and
`X-Job-Run-Id`.

It does not contain catalog, analytics, billing, or reservation business logic.
It does not access other service databases and it is not a live-user-action
orchestrator.

## Owned database

`scheduler-postgres`

Owned tables:

| Table | Purpose |
|---|---|
| `scheduled_jobs` | Job definitions, schedule configuration, target service/path, enabled state, and last-run summary |
| `job_runs` | Run history, trigger type, target HTTP result, response summary, error metadata, timing, and correlation ID |

## Gateway exposure

Public through `nginx-gateway` under `/api/scheduler/...`.

| Service route | Gateway route | Access |
|---|---|---|
| `GET /health` | `/api/scheduler/health` | Public health metadata |
| `GET /jobs` | `/api/scheduler/jobs` | `OPERATOR` only |
| `GET /jobs/{job_key}` | `/api/scheduler/jobs/{job_key}` | `OPERATOR` only |
| `PATCH /jobs/{job_key}` | `/api/scheduler/jobs/{job_key}` | `OPERATOR` only |
| `POST /jobs/{job_key}/run` | `/api/scheduler/jobs/{job_key}/run` | `OPERATOR` only |
| `POST /jobs/{job_key}/pause` | `/api/scheduler/jobs/{job_key}/pause` | `OPERATOR` only |
| `POST /jobs/{job_key}/resume` | `/api/scheduler/jobs/{job_key}/resume` | `OPERATOR` only |
| `GET /runs` | `/api/scheduler/runs` | `OPERATOR` only |
| `GET /runs/{run_id}` | `/api/scheduler/runs/{run_id}` | `OPERATOR` only |

The frontend operator Sync and System pages use these gateway routes only.

## Job definitions

Default jobs are seeded idempotently at startup.

| Job key | Target service/path | Schedule |
|---|---|---|
| `catalog.import.all` | `catalog-service` `/internal/jobs/catalog/imports/all` | every 15 minutes |
| `analytics.consume-events` | `analytics-service` `/internal/jobs/events/consume` | every 60 seconds |
| `analytics.refresh-aggregates` | `analytics-service` `/internal/jobs/aggregates/refresh` | every 5 minutes |
| `billing.drain-events` | `billing-service` `/internal/jobs/events/drain` | every 60 seconds |
| `billing.publish-outbox` | `billing-service` `/internal/jobs/outbox/publish-pending` | every 60 seconds |
| `reservation.publish-outbox` | `reservation-service` `/internal/jobs/outbox/publish-pending` | every 60 seconds |
| `billing.prepare-invoices` | `billing-service` `/internal/jobs/invoices/prepare` | daily at 02:30 Europe/Athens |
| `catalog.import.red` | `catalog-service` `/internal/jobs/catalog/imports/providers/redPlug` | manual |
| `catalog.import.green` | `catalog-service` `/internal/jobs/catalog/imports/providers/greenPlug` | manual |
| `catalog.import.blue` | `catalog-service` `/internal/jobs/catalog/imports/providers/bluePlug` | manual |
| `analytics.refresh-aggregates.manual` | `analytics-service` `/internal/jobs/aggregates/refresh` | manual |
| `billing.drain-events.manual` | `billing-service` `/internal/jobs/events/drain` | manual |

`billing.prepare-invoices` is a safe non-mutating preparation job. Invoice
issuance remains an explicit operator billing action.

## Internal endpoint security

Target service-owned internal job endpoints require:

```text
X-Scheduler-Token: <private scheduler token>
X-Job-Run-Id: <scheduler run id>
```

The token comes from private runtime configuration and must match across
`scheduler-service`, `catalog-service`, `analytics-service`,
`billing-service`, and `reservation-service`. It must never be committed or
printed.

The Nginx gateway intentionally returns HTTP 404 for:

```text
/api/catalog/internal/
/api/analytics/internal/
/api/billing/internal/
/api/reservations/internal/
```

The scheduler calls targets only through Docker-internal service URLs.

## Important files

| Path | Purpose |
|---|---|
| `app/main.py` | FastAPI application, startup database initialization, scheduler loop startup |
| `app/models.py` | Scheduler metadata models |
| `app/jobs.py` | Seeded job definitions and scheduling calculations |
| `app/executor.py` | Job run lifecycle and internal HTTP invocation |
| `app/runner.py` | Background scheduler loop |
| `app/routes.py` | Operator scheduler APIs and public health endpoint |
| `app/security.py` | JWT role validation for operator-only APIs |
| `tests/test_scheduler_service_api.py` | Focused scheduler API and execution tests |

## Runtime configuration

Relevant environment variables are defined with safe placeholders in
`.env.example`.

```text
SCHEDULER_DATABASE_URL
JWT_SECRET
SCHEDULER_TICK_SECONDS
SCHEDULER_MAX_CONCURRENT_JOBS
SCHEDULER_INSTANCE_ID
SCHEDULER_INTERNAL_TOKEN
SCHEDULER_HTTP_TIMEOUT_SECONDS
SCHEDULER_RUN_LOOP
CATALOG_SERVICE_URL
ANALYTICS_SERVICE_URL
BILLING_SERVICE_URL
RESERVATION_SERVICE_URL
```

## Commands

Run the scheduler service tests:

```bash
docker compose run --build --rm --no-deps scheduler-service pytest -q
```

Run the scheduler in the full stack:

```bash
docker compose up -d --build
curl http://localhost:8080/api/scheduler/health
```

Operator-only calls require an `OPERATOR` bearer token:

```bash
curl http://localhost:8080/api/scheduler/jobs \
  -H "Authorization: Bearer <operator-access-token>"
```

## Boundary Notes

- The scheduler owns only metadata and run history.
- Target services own their internal job implementation and data mutations.
- Live user actions remain synchronous through their responsible services.
- RabbitMQ is not used for login, map search, point details, status lookup, or
  reservation provider calls.
- The scheduler must not read or write other service databases.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
