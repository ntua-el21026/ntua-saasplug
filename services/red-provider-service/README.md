# red-provider-service

## Responsibility

`red-provider-service` owns the `redPlug` provider adapter. It calls the
`redPlug` external API, normalizes payloads into internal DTOs, stores
provider-local point snapshots, stores raw payloads for traceability, records
sync runs, and exposes internal-only endpoints for future catalog, status, and
reservation services.

## Owned database

`red-provider-postgres`

Owned tables:

| Table | Purpose |
|---|---|
| `provider_point_snapshots` | Latest normalized local snapshot per `redPlug` point |
| `raw_provider_payloads` | Raw provider responses by endpoint and point |
| `provider_sync_runs` | Sync run status, counts, and failure messages |
| `provider_point_changes` | Simple provider-local change metadata |

## Provider API source

Source of truth:

```text
docs/assignment/providers/yaml/redPlug.yaml
```

External endpoint mapping:

| Internal action | `redPlug` endpoint |
|---|---|
| List points | `GET /points` |
| Point details/status | `GET /point/{pointid}` |
| Reservation default | `POST /reserve/{pointid}` |
| Reservation with duration | `POST /reserve/{pointid}/{minutes}` |

Provider fields mapped:

| Internal field | `redPlug` field |
|---|---|
| `external_point_id` | `pointid` |
| `status` | `status` |
| `reservation_ends_at` | `reservationendtime` |
| `capacity` | `cap` |
| `connector` | `connector` |
| `location_name` | `locationName` |
| `address` | `address` |
| `price_per_kwh_eur` | not provided by redPlug |

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

Point snapshots use:

```text
provider_code
external_point_id
normalized_point_id
status
reservation_ends_at
price_per_kwh_eur
capacity
connector
location_name
address
raw_payload
last_seen_at
```

Status responses use:

```text
provider_code
external_point_id
normalized_point_id
status
reservation_ends_at
checked_at
```

Reservation responses use:

```text
provider_code
external_point_id
normalized_point_id
provider_reservation_id
status
reservation_ends_at
price_per_kwh_eur
raw_payload
```

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

`POST /internal/sync` calls `GET /points`, stores raw payloads, upserts local
point snapshots, records change metadata, and writes a sync run. If the
provider call fails, previous snapshots are preserved and a failed sync run is
recorded.

Prompt 05 does not publish RabbitMQ events or write catalog data.

## Safe secret handling

Runtime configuration uses:

```text
PROVIDER_BASE_URL
RED_PROVIDER_BASE_URL
PROVIDER_API_TIMEOUT_SECONDS
PROVIDER_API_KEY_ENV_VAR
RED_PROVIDER_API_KEY
```

The service may send the optional provider key in the provider `authorization`
header when configured. It returns only the key environment-variable name in
metadata responses and never returns raw API key values.

## Tests

```bash
docker compose run --rm --no-deps red-provider-service pytest -q
```

Tests use fake provider HTTP responses and do not require live `redPlug`
availability.

## Limitations

- `catalog-service` aggregation is Prompt 06 scope.
- `status-service` owns the future 5-minute status cache.
- `reservation-service` owns reservation truth and events.
- Analytics, billing, frontend screens, and RabbitMQ business consumers are out
  of scope here.
