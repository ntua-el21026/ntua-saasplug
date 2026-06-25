# green-provider-service

## Purpose

Internal adapter for `greenPlug`. It calls the external greenPlug API,
normalizes responses, and stores provider-local snapshots and raw payloads.

## Runtime

- Compose service: `green-provider-service`
- Container port: `8000`
- Database: `green-provider-postgres`
- Main app: `app/main.py`
- API prefix: `/internal`

## Responsibilities

- Sync greenPlug point lists from `/chargingPoints`.
- Read point detail/status through `/chargingPoints/{pointid}`.
- Reserve points through `/chargingPoints/{pointid}/reservations`.
- Store raw provider payloads, normalized snapshots, sync runs, and point
  changes.
- Expose normalized internal DTOs to catalog, status, and reservation services.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Internal | `GET /internal/provider` | Provider identity |
| Internal | `GET /internal/points` | Local normalized snapshots |
| Internal | `POST /internal/sync` | Fetch and store latest greenPlug list |
| Internal | `GET /internal/points/{external_point_id}` | Point detail |
| Internal | `GET /internal/points/{external_point_id}/status` | Live status/detail |
| Internal | `POST /internal/points/{external_point_id}/reservations` | Provider reservation mutation |
| Internal | `GET /internal/sync-runs` | Sync history |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `provider_point_snapshots` | Latest normalized greenPlug point state |
| `raw_provider_payloads` | Stored external API responses |
| `provider_sync_runs` | Sync run status and counts |
| `provider_point_changes` | Change records from sync/detail updates |

## Messaging

This service does not publish or consume RabbitMQ events in the current
implementation.

## Dependencies

- Calls: external greenPlug API using Bearer provider API key when configured.
- Called by: `catalog-service`, `status-service`, `reservation-service`.
- External systems: greenPlug provider API.

## Tests

```bash
docker compose run --build --rm --no-deps green-provider-service pytest -q
```
