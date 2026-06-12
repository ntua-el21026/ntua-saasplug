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

## Exposure

Public through `nginx-gateway` under `/api/catalog/...`.

Gateway route behavior strips `/api/catalog/`, so service-local routes are:

```text
GET  /points
GET  /points/{provider_code}/{external_point_id}
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
- RabbitMQ business publishers or consumers for Prompt 06.
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

1. creates a `catalog_import_runs` row with status `running`;
2. triggers the provider-service sync endpoint;
3. reads the provider-service normalized point snapshots;
4. upserts catalog rows by `(provider_code, external_point_id)`;
5. records simple point-change metadata when fields change;
6. marks provider points missing from the latest import as `is_active=false`
   and `is_stale=true`;
7. records final counts and completion/failure status.

Raw provider payloads are stored in `catalog_points.raw_provider_payload`, but
sensitive-looking keys such as API keys, tokens, passwords, and authorization
headers are redacted before storage and API exposure.

## Authorization

`catalog-service` validates auth-service-compatible HS256 JWT access tokens
with the shared `JWT_SECRET`.

| Endpoint | Access |
|---|---|
| `GET /points` | Public read of active, non-stale catalog rows by default |
| `GET /points/{provider_code}/{external_point_id}` | Public cached detail read for active, non-stale rows |
| `POST /imports/providers/{provider_code}` | `OPERATOR` only |
| `POST /imports/all` | `OPERATOR` only |
| `GET /imports/runs` | `OPERATOR` all runs; `PROVIDER_ADMIN` own provider only; `EV_USER` forbidden |
| `GET /freshness` | Public non-sensitive per-provider freshness summary |

## Viewport and search behavior

Map search must use viewport/bounds-based loading:

```text
GET /api/catalog/points?minLat=37.9&maxLat=38.1&minLng=23.6&maxLng=23.9
```

Supported query parameters:

```text
minLat
maxLat
minLng
maxLng
providerCode
status
connector
q
includeStale
limit
offset
```

If any bounds are supplied, all four bounds are required. Coordinate-less rows
do not match bounded viewport queries. The default result set includes only
active, non-stale points. `q` searches display name, location name, address, and
normalized point ID.

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
```

`CATALOG_IMPORT_ON_STARTUP` intentionally defaults to `false` so normal stack
startup does not surprise-call provider sync endpoints.

## Runtime baseline

Prompt 06 keeps:

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

## Explicit non-goals

Prompt 06 does not implement:

- `status-service` 5-minute status cache;
- reservation truth or provider reservation calls;
- analytics or billing;
- frontend screens;
- RabbitMQ catalog events;
- provider services exposed through Nginx;
- direct external provider API calls from `catalog-service`.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
