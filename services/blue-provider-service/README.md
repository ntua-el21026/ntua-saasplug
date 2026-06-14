# blue-provider-service

## Responsibility

`blue-provider-service` owns the `bluePlug` provider adapter. It calls the
`bluePlug` external API, normalizes payloads into internal DTOs, stores
provider-local point snapshots, stores raw payloads for traceability, records
sync runs, and exposes internal-only endpoints used by catalog, status, and
reservation services.

## Owned database

`blue-provider-postgres`

Owned tables:

| Table | Purpose |
|---|---|
| `provider_point_snapshots` | Latest normalized local snapshot per `bluePlug` point |
| `raw_provider_payloads` | Raw provider responses by endpoint and point |
| `provider_sync_runs` | Sync run status, counts, and failure messages |
| `provider_point_changes` | Simple provider-local change metadata |

## Provider API source

Source of truth:

```text
docs/assignment/providers/yaml/bluePlug.yaml
docs/assignment/providers/postman_collections/bluePlug.postman_collection.json
```

External endpoint mapping:

| Internal action | `bluePlug` endpoint |
|---|---|
| List points | `GET /locations` |
| Point details/status | `GET /location/{pointid}/status` |
| Reservation | `POST /location/{pointid}/hold?minutes=...` |

Provider fields mapped:

| Internal field | `bluePlug` field |
|---|---|
| `external_point_id` | `chargerId` |
| `status` | `currentStatus` |
| `reservation_ends_at` | `reservationEnd` |
| `price_per_kwh_eur` | `pricePerKwh` |
| `capacity` | `cap` |
| `connector` | `connector` |
| `location_name` | `locationName` |
| `address` | `address` |

## Internal endpoints

Provider services are internal-only and are not routed through Nginx.

```text
GET  /
GET  /health
GET  /ready
GET  /internal/provider
GET  /internal/points
POST /internal/sync
GET  /internal/points/{external_point_id}
GET  /internal/points/{external_point_id}/status
POST /internal/points/{external_point_id}/reservations
GET  /internal/sync-runs
```

## Normalized DTOs

Point, status, and reservation responses use the same normalized JSON shapes as
the other provider services:

```text
provider_code
external_point_id
normalized_point_id
status
reservation_ends_at
price_per_kwh_eur
raw_payload
```

Point responses additionally include capacity, connector, location, address,
and `last_seen_at`. Status responses include `checked_at`.

Status values are normalized to:

```text
available
charging
reserved
malfunction
offline
unknown
```

Unexpected, missing, or unmapped provider statuses become `unknown`.

## Sync behavior

`POST /internal/sync` calls `GET /locations`, stores raw payloads, upserts
local point snapshots, records change metadata, and writes a sync run. If the
provider call fails, previous snapshots are preserved and a failed sync run is
recorded.

Prompt 05 does not publish RabbitMQ events or write catalog data.

## Safe secret handling

Runtime configuration uses:

```text
PROVIDER_BASE_URL
BLUE_PROVIDER_BASE_URL
PROVIDER_API_TIMEOUT_SECONDS
PROVIDER_AUTH_SCHEME=Bearer
PROVIDER_API_KEY_ENV_VAR
BLUE_PROVIDER_API_KEY
```

When configured, the service sends the provider key as
`Authorization: Bearer <api-key>`. It returns only the key environment-variable
name in metadata responses and never returns raw API key values.

## Tests

```bash
docker compose run --rm --no-deps blue-provider-service pytest -q
```

Tests use fake provider HTTP responses and do not require live `bluePlug`
availability.

## Limitations

- `catalog-service` owns the aggregated catalog.
- `status-service` owns the five-minute status cache.
- `reservation-service` owns reservation truth and events.
- Analytics, billing, frontend screens, and RabbitMQ business consumers are
  outside this service boundary.
