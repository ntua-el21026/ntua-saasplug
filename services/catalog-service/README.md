# catalog-service

## Purpose

Owns the aggregated normalized charging-point catalog, search/detail APIs,
provider imports, catalog freshness, and point-view usage events.

## Runtime

- Compose service: `catalog-service`
- Container port: `8000`
- Database: `catalog-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/catalog/*`

## Responsibilities

- Search catalog points using filters, paging, and radius queries.
- Return point detail snapshots from `catalog_points`.
- Record point views best-effort for analytics/billing.
- Import provider snapshots from internal provider adapters.
- Use import locks to prevent duplicate provider imports.
- Seed imported statuses into `status-service`.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Public/auth-aware | `GET /points` | Search catalog by filters and radius/bounds |
| Public/auth-aware | `GET /points/{provider_code}/{external_point_id}` | Point detail |
| Public/auth-aware | `POST /points/{provider_code}/{external_point_id}/views` | Record point view |
| Operator | `POST /imports/providers/{provider_code}` | Import one provider |
| Operator | `POST /imports/all` | Import all providers |
| Internal scheduler | `POST /internal/jobs/catalog/imports/providers/{provider_code}` | Scheduled provider import |
| Internal scheduler | `POST /internal/jobs/catalog/imports/all` | Scheduled all-provider import |
| Authenticated | `GET /imports/runs` | Import run history |
| Public/auth-aware | `GET /freshness` | Provider freshness summary |
| Internal scheduler | `GET /internal/jobs/catalog/freshness` | Internal freshness read |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `catalog_points` | Aggregated normalized point snapshots |
| `catalog_import_runs` | Import run status and counts |
| `catalog_import_locks` | Per-provider import lock rows |
| `catalog_point_changes` | Catalog change records |

## Messaging

| Direction | Event/routing key/queue | Purpose |
|---|---|---|
| Publish | `usage.search_performed` | Best-effort search event |
| Publish | `usage.point_viewed` | Best-effort point-view event |
| Publish | `catalog.points.imported` | Completed import summary |

## Dependencies

- Calls: red/green/blue provider adapters, `status-service` internal cache seed,
  RabbitMQ when publishing is enabled.
- Called by: frontend through gateway, `reservation-service`, `scheduler-service`.
- External systems: none directly; provider APIs are reached through adapters.

## Tests

```bash
docker compose run --build --rm --no-deps catalog-service pytest -q
```
