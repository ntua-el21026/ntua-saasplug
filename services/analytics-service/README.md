# analytics-service

## Purpose

Consumes implemented business events, stores analytics input rows and snapshots,
refreshes aggregate tables, and exposes EV, provider, and operator analytics.

## Runtime

- Compose service: `analytics-service`
- Container port: `8000`
- Database: `analytics-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/analytics/*`

## Responsibilities

- Ingest or consume analytics events idempotently.
- Store usage events, catalog health snapshots, and billing summary snapshots.
- Refresh provider, point, status, operator, and EV reservation aggregates.
- Expose provider/operator dashboards and EV reservation summary.
- Export provider/operator usage CSV through the API.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Authenticated | `POST /events/ingest` | Direct event ingest |
| Operator | `POST /events/consume` | Consume analytics queue |
| Operator | `POST /aggregates/refresh` | Refresh aggregate tables |
| Operator | `POST /operator/refresh` | Consume then refresh for operator UI |
| Internal scheduler | `POST /internal/jobs/events/consume` | Scheduled queue drain |
| Internal scheduler | `POST /internal/jobs/aggregates/refresh` | Scheduled aggregate refresh |
| Internal scheduler | `GET /internal/jobs/freshness` | Internal freshness read |
| Provider admin/operator | `GET /provider/*` | Provider analytics views |
| EV | `GET /ev/reservations/summary` | EV reservation summary |
| Operator | `GET /operator/*` | Operator analytics views |
| Provider admin/operator | `GET /exports/usage.csv` | Usage CSV export |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `usage_events` | Raw consumed/ingested event rows |
| Metric tables | Provider, point, status, operator, and EV reservation aggregates |
| `catalog_health_snapshots` | Catalog import/freshness snapshots |
| `billing_summary_snapshots` | Billing summary snapshots from billing events |
| `export_jobs` | CSV export audit rows |

## Messaging

| Direction | Event/routing key/queue | Purpose |
|---|---|---|
| Consume | `analytics.events` | Usage, status, reservation, catalog, and billing events |

## Dependencies

- Calls: RabbitMQ when draining events.
- Called by: frontend through gateway, `scheduler-service`, billing/catalog/status/reservation event flow.
- External systems: none.

## Tests

```bash
docker compose run --build --rm --no-deps analytics-service pytest -q
```
