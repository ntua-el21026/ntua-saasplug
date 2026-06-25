# status-service

## Purpose

Owns point-status cache, cache policy, live provider status refresh, stale
fallback behavior, and status lookup logs.

## Runtime

- Compose service: `status-service`
- Container port: `8000`
- Database: `status-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/status/*`

## Responsibilities

- Serve cache-only batch status reads for visible map/list points.
- Refresh live status for selected points when cache is expired or forced.
- Use per-point in-process locking to avoid duplicate live refreshes.
- Return stale cached status with a warning when provider refresh fails.
- Store status check logs and cache policy.
- Seed cache rows from catalog imports and successful reservations.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Authenticated | `POST /cache/statuses` | Cache-only batch lookup |
| Internal | `POST /internal/cache/seed` | Seed cache from catalog/reservation |
| Authenticated | `POST /points/statuses` | Batch live/cache lookup |
| Authenticated | `GET /points/{provider_code}/{external_point_id}/status` | Single live/cache lookup |
| Authenticated | `GET /points/{provider_code}/{external_point_id}` | Compatibility alias |
| Authenticated | `GET /cache/{provider_code}/{external_point_id}` | Read cache row |
| Authenticated | `GET /cache/policy` | Read cache policy |
| Operator | `PATCH /cache/policy` | Update cache policy |
| Authenticated | `GET /logs` | Status lookup logs |
| Public/auth-aware | `GET /freshness` | Provider freshness summary |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `status_cache` | Latest status/cache metadata per point |
| `status_cache_policy` | TTL and stale-window settings |
| `status_check_logs` | Lookup, fallback, provider-call, and error logs |

## Messaging

| Direction | Event/routing key/queue | Purpose |
|---|---|---|
| Publish | `status.point_checked` | Best-effort lookup event for analytics |

## Dependencies

- Calls: provider adapters for live status; RabbitMQ for status events.
- Called by: frontend through gateway, `catalog-service`, `reservation-service`.
- External systems: provider APIs only through provider adapters.

## Tests

```bash
docker compose run --build --rm --no-deps status-service pytest -q
```
