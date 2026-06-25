# catalog-service

## Responsibility

`catalog-service` owns the aggregated normalized charging-point catalog used by
search, map, and point details flows. It imports normalized snapshots from the
three provider services and stores the local read model used by gateway-facing
catalog APIs.

## Owned database

`catalog-postgres`

Tables created by the service at MVP startup:

| Table | Purpose |
|---|---|
| `catalog_points` | Aggregated normalized point rows across `redPlug`, `greenPlug`, and `bluePlug` |
| `catalog_import_runs` | Provider import run records, counts, status, and errors |
| `catalog_point_changes` | Simple change metadata for created, updated, and stale/inactive points |
| `catalog_import_locks` | Short-lived provider-level import locks used to reject overlapping imports for the same provider |

## Exposure

Public through `nginx-gateway` under `/api/catalog/...`.

Gateway route behavior strips `/api/catalog/`, so service-local routes are:

```text
GET  /points
GET  /points/{provider_code}/{external_point_id}
POST /points/{provider_code}/{external_point_id}/views
POST /imports/providers/{provider_code}
POST /imports/all
GET  /imports/runs
GET  /freshness
```

## Belongs here

- Aggregated catalog API implementation.
- Catalog projections imported from provider snapshots.
- Bounds-based search and point-detail tests.
- Local catalog persistence and import/change metadata.

## Must not be placed here

- Provider-specific raw API calls in the normal user search path.
- Reservation truth.
- Status cache ownership.
- RabbitMQ consumers or queue-drain workers.
- Cross-service SQL joins.

## Provider-service import flow

Operator-triggered imports call provider services over Docker-internal URLs:

```text
catalog-service -> red-provider-service   POST /internal/sync
catalog-service -> red-provider-service   GET  /internal/points
catalog-service -> green-provider-service POST /internal/sync
catalog-service -> green-provider-service GET  /internal/points
catalog-service -> blue-provider-service  POST /internal/sync
catalog-service -> blue-provider-service  GET  /internal/points
```

`catalog-service` consumes the normalized provider-service DTOs. It does not
read provider databases and does not call external provider APIs directly.

Each import:

1. acquires a short-lived provider-level import lock;
2. creates a `catalog_import_runs` row with status `running`;
3. triggers the provider-service sync endpoint;
4. reads the provider-service normalized point snapshots;
5. upserts catalog rows by `(provider_code, external_point_id)`;
6. records simple point-change metadata when fields change;
7. marks provider points missing from the latest import as `is_active=false`
   and `is_stale=true`;
8. records final counts and completion/failure status;
9. releases the provider-level import lock;
10. publishes a best-effort `catalog.points.imported` analytics event after a
   successful import.

If an import is already active for the same provider, the single-provider API
returns HTTP 409 and the all-provider API reports that provider as `skipped`.
Imports for different providers may proceed independently. Locks have a
bounded stale timeout so a failed process does not permanently block future
imports.

Raw provider payloads are stored in `catalog_points.raw_provider_payload`, but
sensitive-looking keys such as API keys, tokens, passwords, and authorization
headers are redacted before storage and API exposure.

## Authorization

`catalog-service` validates auth-service-compatible HS256 JWT access tokens
with the shared `JWT_SECRET`.

| Endpoint | Access |
|---|---|
| `GET /points` | Public read of active, non-stale catalog rows by default; authenticated `PROVIDER_ADMIN` requests are scoped to the admin's own provider |
| `GET /points/{provider_code}/{external_point_id}` | Public cached detail read for active, non-stale rows |
| `POST /points/{provider_code}/{external_point_id}/views` | Best-effort point-view tracking for marker/list quick views; optional request status should come from `status-service` |
| `POST /imports/providers/{provider_code}` | `OPERATOR` only |
| `POST /imports/all` | `OPERATOR` only |
| `GET /imports/runs` | `OPERATOR` all runs; `PROVIDER_ADMIN` own provider only; `EV_USER` forbidden |
| `GET /freshness` | Public non-sensitive per-provider freshness summary |

## Viewport and search behavior

Map search must use viewport/bounds-based loading:

```text
GET /api/catalog/points?minLat=37.9&maxLat=38.1&minLng=23.6&maxLng=23.9
```

Catalog rows include the last imported provider snapshot status, but frontend
current-status displays must resolve status through `status-service`. When the
frontend tracks a marker/list quick view, it may include the status-service
status in the `POST /points/{provider_code}/{external_point_id}/views` body so
analytics and billing observe the same status the user saw.

Supported query parameters:

```text
minLat
maxLat
minLng
maxLng
centerLat
centerLng
radiusKm
providerCode
status
connector
q
includeStale
limit
offset
```

If any bounds are supplied, all four bounds are required. If any radius
parameter is supplied, `centerLat`, `centerLng`, and `radiusKm` are all
required. Radius queries are capped at 10 km to prevent accidental broad map
loads. They use a SQL bounding-box prefilter followed by exact Haversine
distance filtering before `total`, `limit`, and `offset` are applied, so
returned rows are inside the requested circle. Radius responses include
`search_circle` with the exact center and radius applied by the service.
Coordinate-less rows do not match bounded or radius queries. The default result
set includes only active, non-stale points. `q` searches display name, location
name, address, and normalized point ID.

## Coordinate limitation

The current provider-service normalized DTOs do not expose latitude or
longitude fields. For MVP map usability, catalog imports assign stable
Athens-area demo coordinates derived from `(provider_code, external_point_id)`.

API responses expose:

```text
coordinate_source=demo_synthetic
```

These coordinates are deterministic demo data, not provider-provided
coordinates. Rows may still support nullable coordinates and
`coordinate_source=missing` if future provider data or tests insert rows without
coordinates.

## Runtime configuration

Safe defaults are provided through `docker-compose.yml` and `.env.example`:

```text
RED_PROVIDER_SERVICE_URL=http://red-provider-service:8000
GREEN_PROVIDER_SERVICE_URL=http://green-provider-service:8000
BLUE_PROVIDER_SERVICE_URL=http://blue-provider-service:8000
CATALOG_PROVIDER_HTTP_TIMEOUT_SECONDS=10
CATALOG_IMPORT_ON_STARTUP=false
JWT_SECRET=change-me-in-local-env
SCHEDULER_INTERNAL_TOKEN=change-me-scheduler-token
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
RABBITMQ_EVENT_EXCHANGE=saasplug.events
RABBITMQ_PUBLISH_TIMEOUT_SECONDS=5
CATALOG_RABBITMQ_EVENT_PUBLISH_ENABLED=true
SAASPLUG_STRICT_SECRETS=false
APP_ENV=local
```

`CATALOG_IMPORT_ON_STARTUP` intentionally defaults to `false` so normal stack
startup does not surprise-call provider sync endpoints.
When `SAASPLUG_STRICT_SECRETS=true` or `APP_ENV` is production-like, unsafe
placeholder JWT, scheduler-token, and RabbitMQ credential values are rejected
at startup.

## Analytics events

`catalog-service` publishes best-effort analytics events through the shared
RabbitMQ topology:

| Event | Published after | Notes |
|---|---|---|
| `usage.search_performed` | First page of `GET /points` completes | Includes filters, matched provider codes, result count, and authenticated user id when a bearer token is present |
| `usage.point_viewed` | `GET /points/{provider_code}/{external_point_id}` returns an active point, or `POST /points/{provider_code}/{external_point_id}/views` records a map/list quick view | Includes provider, normalized point id, external point id, point name, point status, view source, and authenticated user id when available |
| `catalog.points.imported` | A provider import completes successfully | Includes provider/import counts for analytics catalog-health projections |

Event publishing is best-effort and non-blocking for user-facing catalog reads.
If RabbitMQ is unavailable after the catalog operation completes, the catalog
response still succeeds.

## Internal scheduler endpoints

`scheduler-service` calls these service-owned endpoints over Docker-internal
URLs with `X-Scheduler-Token` and `X-Job-Run-Id`:

```text
POST /internal/jobs/catalog/imports/providers/{provider_code}
POST /internal/jobs/catalog/imports/all
GET  /internal/jobs/catalog/freshness
```

The Nginx gateway returns HTTP 404 for `/api/catalog/internal/...`; these
routes are not browser-facing APIs.

## Runtime baseline

```text
GET /
GET /health
GET /ready
```

Gateway health smoke test:

```bash
curl http://localhost:8080/api/catalog/health
```

Containerized catalog tests:

```bash
docker compose run --rm --no-deps catalog-service pytest -q
```

## Boundary Notes

- `status-service` owns the five-minute status cache.
- `reservation-service` owns reservation truth and provider reservation calls.
- Analytics and billing own their own projections and financial data.
- Provider services are not exposed through Nginx.
- `catalog-service` does not call external provider APIs directly.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
