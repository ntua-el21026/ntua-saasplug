# scheduler-service

## Purpose

Operator-facing job control plane for service-owned internal jobs. It stores
job metadata and run history, then calls target service endpoints over the
Docker network with `X-Scheduler-Token`.

## Runtime

- Compose service: `scheduler-service`
- Container port: `8000`
- Database: `scheduler-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/scheduler/*`

## Responsibilities

- Seed implemented job definitions.
- List, patch, pause, resume, and manually run jobs.
- Apply minimum/default interval presets.
- Run the ordered maintenance sequence.
- Persist job run status, target HTTP status, retries, timeouts, and summaries.
- Recover stale running jobs after timeout.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Operator | `GET /jobs` | List jobs |
| Operator | `POST /jobs/intervals/apply-minimum` | Apply minimum intervals |
| Operator | `POST /jobs/intervals/reset-defaults` | Restore seeded intervals |
| Operator | `GET /jobs/{job_key}` | Job detail |
| Operator | `PATCH /jobs/{job_key}` | Edit schedule/timeout/retry fields |
| Operator | `POST /jobs/{job_key}/run` | Manual run |
| Operator | `POST /jobs/run-maintenance` | Ordered maintenance sequence |
| Operator | `POST /jobs/{job_key}/pause` | Pause job |
| Operator | `POST /jobs/{job_key}/resume` | Resume job |
| Operator | `GET /runs`, `GET /runs/{run_id}` | Run history |
| Public | `GET /health` | Scheduler health |

## Seeded Jobs

| Job key | Target |
|---|---|
| `catalog.import.all` | `catalog-service /internal/jobs/catalog/imports/all` |
| `analytics.consume-events` | `analytics-service /internal/jobs/events/consume` |
| `analytics.refresh-aggregates` | `analytics-service /internal/jobs/aggregates/refresh` |
| `billing.drain-events` | `billing-service /internal/jobs/events/drain` |
| `billing.publish-outbox` | `billing-service /internal/jobs/outbox/publish-pending` |
| `reservation.publish-outbox` | `reservation-service /internal/jobs/outbox/publish-pending` |
| `billing.prepare-invoices` | `billing-service /internal/jobs/invoices/prepare` |
| `catalog.import.red`, `.green`, `.blue` | Provider-specific catalog import jobs |
| `analytics.refresh-aggregates.manual` | Manual analytics aggregate refresh |
| `billing.drain-events.manual` | Manual billing queue drain |

## Persistence

| Table | Purpose |
|---|---|
| `scheduled_jobs` | Job definitions, schedule, pause/enabled state |
| `job_runs` | Run status, timing, retry, and response summaries |

## Messaging

This service does not publish or consume RabbitMQ events directly. It triggers
other services' internal drain/publish endpoints.

## Dependencies

- Calls: catalog, reservation, billing, and analytics internal job endpoints.
- Called by: frontend through `nginx-gateway`.
- External systems: none.

## Tests

```bash
docker compose run --build --rm --no-deps scheduler-service pytest -q
```
