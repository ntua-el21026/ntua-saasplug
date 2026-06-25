# analytics-service

## Responsibility

`analytics-service` owns raw usage events, idempotent event ingestion,
precomputed hourly and daily aggregates, EV reservation summaries, provider
analytics, operator analytics, CSV exports, catalog-health projections, billing
summary projections, and dashboard freshness indicators.

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
ev_reservation_daily_metrics
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

Primary live producers are:

| Producer | Events |
|---|---|
| `catalog-service` | `usage.search_performed`, `usage.point_viewed`, `catalog.points.imported` |
| `status-service` | `status.point_checked` |
| `reservation-service` | `reservation.succeeded`, `reservation.failed` |
| `billing-service` | `billing.charge_created`, `billing.invoice_issued`, `billing.invoice_paid` |

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

Queue draining and aggregate refresh are separate jobs. Draining moves RabbitMQ
messages into `usage_events`. Refreshing aggregates recalculates dashboard
tables from `usage_events`; it does not read RabbitMQ directly.

Aggregates include:

- provider hourly metrics,
- provider daily metrics,
- point daily metrics,
- provider point-view status metrics,
- operator daily metrics,
- EV reservation daily metrics.

Status-distribution rows count map/list quick views and full point-detail views
by the normalized point status included in each `usage.point_viewed` event.
They answer how many point views happened while points were `available`,
`reserved`, `charging`, `malfunction`, `offline`, or `unknown`; live
status-check events and reservation events do not move this chart.

Provider daily/hourly metrics also store status cache hits and live provider
status refreshes from `status.point_checked` events. The provider dashboard
uses these fields to show cache hit rate, which answers whether status-service
lookups are being served from cache or forced through provider refreshes.

EV reservation daily metrics are scoped by `user_id` and include total
reservations, successful/failed counts, successful reserved duration, distinct
point keys, estimated-reservation counts, missing-estimate counts, total
estimated energy, and total estimated cost. Distinct point sets are stored in
the aggregate row so summary endpoints can union point keys across days instead
of double-counting a point reserved on multiple days.

Estimated cost is derived only when valid inputs exist:

```text
estimated_energy_kwh = charger_capacity_kw * requested_duration_minutes / 60
estimated_cost_eur = price_per_kwh_eur * estimated_energy_kwh
```

If cost/kWh, charger power, or duration is missing or invalid, the estimate
remains unavailable and is excluded from cost totals and averages.

Manual aggregate refresh and the scheduler internal aggregate refresh both
rebuild EV reservation metrics together with provider/operator metrics.

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

The dashboard endpoints `GET /provider/summary`,
`GET /provider/trends/daily`, `GET /provider/top-points`, and
`GET /provider/status-distribution` accept optional `from` and `to` date query
parameters in `YYYY-MM-DD` format. The date range is inclusive and filters the
precomputed provider, point, and status daily aggregate rows returned to the
frontend. Status distribution rows count `usage.point_viewed` events from
map/list quick views and full point-detail views by the point status included
in each view event, so the chart answers "how many point views happened while
points were available, reserved, charging, malfunctioning, offline, or
unknown."

Provider-admin analytics endpoints are read-only. Provider pages do not trigger
queue consumption or aggregate refresh.

## Operator analytics endpoints

Operator-only endpoints:

```text
GET /operator/summary
GET /operator/provider-comparison
GET /operator/trends/daily
GET /operator/catalog-health
GET /operator/freshness
POST /operator/refresh?limit=100
```

Operator dashboards are projection-limited to events that analytics has
ingested and aggregates that have been refreshed.

`POST /operator/refresh` is operator-only. It consumes at most the smaller of
the requested limit and `ANALYTICS_RABBITMQ_CONSUME_BATCH_SIZE`, persists new
events, acknowledges duplicates through ingestion idempotency, and rejects
invalid or unsupported messages according to queue policy. It then rebuilds
analytics-owned aggregates from `usage_events`. It does not publish RabbitMQ
events.

`observed_amount`, displayed as `Tracked revenue`, sums estimated EV charging
payments from `reservation.succeeded` events. Analytics prefers the event's
explicit `estimated_cost_eur`; otherwise it computes
`price_per_kwh_eur * charger_capacity_kw * requested_duration_minutes / 60`
when all inputs are valid. Failed reservations and `billing.*` events are
excluded. Billing-service separately calculates the SaaS fees charged by the
operator to providers.

## EV reservation analytics endpoint

EV users can read only their own reservation summary. The endpoint is scoped to
the JWT `sub`; it does not accept a user ID parameter.

```text
GET /ev/reservations/summary
```

The response includes:

```text
total_reservations
successful_reservations
failed_reservations
total_duration_minutes
distinct_points
estimated_reservations
missing_estimate_count
total_estimated_energy_kwh
total_estimated_cost_eur
average_estimated_cost_per_point_eur
average_estimated_cost_per_reservation_eur
currency
estimate_basis
last_event_ingested_at
last_aggregate_computed_at
analytics_delay_notice
```

`average_estimated_cost_per_point_eur` is calculated from points that have at
least one valid estimate, so missing provider cost/kWh or missing charger power
does not silently count as zero.

## CSV export

Provider-admin CSV export columns are intentionally minimized:

```text
occurred_at,event_type,provider_code,internal_point_id,external_point_id,point_name,status,amount,currency,reservation_reference
```

The provider export omits direct `user_id`, direct `reservation_id`, and raw
event `details`. `reservation_reference` is a stable short hash for provider
reconciliation without exposing the underlying EV user or reservation
identifier.

Operator exports remain richer and include:

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
SAASPLUG_STRICT_SECRETS
APP_ENV
```

When `SAASPLUG_STRICT_SECRETS=true` or `APP_ENV` is production-like, unsafe
placeholder JWT, scheduler-token, and RabbitMQ credential values are rejected
at startup.

## Tests

```bash
docker compose run --build --rm --no-deps analytics-service pytest -q
docker compose run --rm --no-deps analytics-service python -m pytest /tmp/packages/events/tests -q
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `packages/events/README.md`
