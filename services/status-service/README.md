# status-service

## Responsibility

`status-service` owns charging-point status lookup, the five-minute status
cache, status check logs, and fallback behavior when provider status lookup
fails.

## Owned database

`status-postgres`

Tables created by the service at MVP startup:

| Table | Purpose |
|---|---|
| `status_cache` | Last known normalized status per `(provider_code, external_point_id)` with TTL metadata |
| `status_check_logs` | Status lookup audit/log records with requester, cache, provider, and error metadata |

## Exposure

Public through `nginx-gateway` under `/api/status/...`.

Gateway route behavior strips `/api/status/`, so service-local routes are:

```text
GET /points/{provider_code}/{external_point_id}/status
GET /points/{provider_code}/{external_point_id}
GET /cache/{provider_code}/{external_point_id}
GET /logs
GET /freshness
```

## Belongs here

- Status cache implementation.
- Status lookup normalization.
- Status freshness, logging, and cache-behavior tests.
- Timeout/error fallback to last known cached status.

## Must not be placed here

- Catalog search ownership.
- Reservation truth.
- Analytics aggregate ownership.
- RabbitMQ business publishers or consumers.
- Direct frontend-provider communication.
- Direct calls to external provider APIs.

## Status cache policy

The default cache TTL is:

```text
STATUS_CACHE_TTL_SECONDS=300
```

Lookup behavior:

1. If a valid cache row exists and `forceRefresh=false`, return cache without
   calling a provider service.
2. If cache is missing, expired, or `forceRefresh=true`, call the relevant
   provider service:

   ```text
   GET /internal/points/{external_point_id}/status
   ```

3. On provider success, normalize status, update `status_cache`, set a new
   `expires_at`, and write a status check log.
4. On provider timeout/error with previous cache, return last known status with
   `returned_stale=true`, `source=cache_fallback`, and a non-sensitive warning.
5. On provider timeout/error with no previous cache, return HTTP 502 with a
   normalized error body and write a failed log.

Provider-specific status values are normalized to:

```text
available
charging
reserved
malfunction
offline
unknown
```

Missing or unrecognized status values normalize to `unknown`.

## Authorization

`status-service` validates auth-service-compatible HS256 JWT access tokens with
the shared `JWT_SECRET`.

| Endpoint | Access |
|---|---|
| `GET /points/{provider_code}/{external_point_id}/status` | Any authenticated role |
| `GET /points/{provider_code}/{external_point_id}` | Any authenticated role |
| `GET /cache/{provider_code}/{external_point_id}` | Any authenticated role; never calls provider services |
| `GET /logs` | `OPERATOR` all logs; `PROVIDER_ADMIN` own provider only; `EV_USER` forbidden |
| `GET /freshness` | Public non-sensitive provider-level metadata |

## Runtime configuration

Safe defaults are provided through `docker-compose.yml` and `.env.example`:

```text
SERVICE_NAME=status-service
DATABASE_URL=postgresql://saasplug:saasplug@status-postgres:5432/status
JWT_SECRET=change-me-in-local-env
STATUS_CACHE_TTL_SECONDS=300
STATUS_PROVIDER_TIMEOUT_SECONDS=10
RED_PROVIDER_SERVICE_URL=http://red-provider-service:8000
GREEN_PROVIDER_SERVICE_URL=http://green-provider-service:8000
BLUE_PROVIDER_SERVICE_URL=http://blue-provider-service:8000
```

The provider-service URLs are Docker-internal service URLs. `status-service`
does not call external provider APIs directly.

## Runtime baseline

The standard runtime endpoints are:

```text
GET /
GET /health
GET /ready
```

Gateway health smoke test:

```bash
curl http://localhost:8080/api/status/health
```

Containerized status tests:

```bash
docker compose run --rm --no-deps status-service pytest -q
```

## Boundary Notes

- `catalog-service` owns catalog aggregation, imports, and search.
- `reservation-service` owns reservation truth and reservation provider calls.
- Analytics and billing own their own projections and financial data.
- Provider services are not exposed through Nginx.
- `status-service` does not call external provider APIs directly.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
