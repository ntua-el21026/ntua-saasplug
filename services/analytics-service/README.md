# analytics-service

## Responsibility

`analytics-service` owns raw usage events, idempotent event ingestion,
precomputed hourly and daily aggregates, provider analytics, operator
analytics, CSV exports, catalog-health projections, billing summary
projections, and dashboard freshness indicators.

## Owned database

`analytics-postgres`

## Exposure

Public through `nginx-gateway` under `/api/analytics/...` for authorized
provider-admin and operator dashboard routes.

## Belongs here

- Event consumption for analytics projections.
- Precomputed aggregate tables and exports.
- Analytics idempotency and dashboard tests.

## Must not be placed here

- Calls to provider APIs.
- Live cross-service joins for dashboards.
- Billing invoice truth.
- Reservation truth.

## Runtime baseline

The service stores canonical events from the shared `packages/events` envelope,
consumes the `analytics.events` RabbitMQ queue through bounded drain endpoints,
computes aggregate/cache rows from analytics-owned data, and serves
provider/operator dashboard JSON and provider usage CSV exports.

No provider API calls, cross-service SQL joins, billing source-of-truth logic,
frontend screens, worker container, or orchestrator service are implemented
here.

## Owned tables

`analytics-service` owns these PostgreSQL tables:

```text
usage_events
provider_hourly_metrics
provider_daily_metrics
point_daily_metrics
provider_status_daily_metrics
operator_daily_metrics
catalog_health_snapshots
billing_summary_snapshots
export_jobs
```

`usage_events.event_id` is unique and provides ingestion idempotency.
`catalog_health_snapshots` and `billing_summary_snapshots` are analytics
projections only; billing truth remains outside this service.

## Event ingestion

Supported event types:

```text
usage.search_performed
usage.point_viewed
status.point_checked
reservation.succeeded
reservation.failed
catalog.points.imported
billing.charge_created
billing.invoice_issued
billing.invoice_paid
```

Manual deterministic ingest endpoint:

```text
POST /events/ingest
```

The endpoint accepts one canonical event envelope or a list of envelopes. It is
operator-only and intended for local MVP demos/tests, not as a public production
event ingestion API.

RabbitMQ drain endpoint:

```text
POST /events/consume?limit=50
```

The endpoint is operator-only. It declares the shared topology if needed,
consumes up to `limit` messages from `analytics.events`, acks successfully
ingested or duplicate events, and rejects invalid or unsupported events so the
queue DLQ policy can route them.

Optional startup topology declaration is controlled by:

```text
ANALYTICS_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP=false
```

Internal scheduler endpoints:

```text
POST /internal/jobs/events/consume
POST /internal/jobs/aggregates/refresh
GET  /internal/jobs/freshness
```

`scheduler-service` calls these endpoints over Docker-internal URLs with
`X-Scheduler-Token` and `X-Job-Run-Id`. The Nginx gateway returns HTTP 404 for
`/api/analytics/internal/...`.

## Aggregates

Manual aggregate refresh endpoint:

```text
POST /aggregates/refresh
```

For the MVP, refresh truncates and rebuilds aggregate/cache tables from
`usage_events`. Dashboards read these precomputed rows, not other services or
live cross-service data.

Aggregates include:

- provider hourly metrics,
- provider daily metrics,
- point daily metrics,
- provider status distribution metrics,
- operator daily metrics.

## Provider analytics endpoints

Provider-admin users are scoped to their JWT `provider_code`. Operators may
optionally pass `providerCode`.

```text
GET /provider/summary
GET /provider/trends/daily
GET /provider/top-points
GET /provider/status-distribution
GET /provider/freshness
GET /exports/usage.csv?providerCode=redPlug&from=2026-06-01&to=2026-06-30
```

Provider admins cannot request another provider's analytics or export.

## Operator analytics endpoints

Operator-only endpoints:

```text
GET /operator/summary
GET /operator/provider-comparison
GET /operator/trends/daily
GET /operator/catalog-health
GET /operator/freshness
```

Operator dashboards are projection-limited to events that analytics has
ingested and aggregates that have been refreshed.

## CSV export

CSV export columns:

```text
occurred_at,event_type,provider_code,internal_point_id,external_point_id,point_name,user_id,reservation_id,status,amount,currency,details
```

Each export writes an `export_jobs` row with actor email, role, provider scope,
selected provider filter, date range, row count, and creation time.

## Health endpoints

The service exposes:

```text
GET /
GET /health
GET /ready
```

Gateway health smoke test:

```bash
curl http://localhost:8080/api/analytics/health
```

## Configuration

Safe placeholder configuration is documented in `.env.example`.

```text
DATABASE_URL
JWT_SECRET
RABBITMQ_URL
RABBITMQ_EVENT_EXCHANGE
ANALYTICS_RABBITMQ_CONSUME_BATCH_SIZE
ANALYTICS_RABBITMQ_CONSUME_TIMEOUT_SECONDS
ANALYTICS_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP
SCHEDULER_INTERNAL_TOKEN
```

## Tests

```bash
docker compose run --build --rm --no-deps analytics-service pytest -q
docker compose run --rm --no-deps analytics-service python -m pytest /tmp/packages/events/tests -q
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `packages/events/README.md`
