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
| `status_cache_policy` | Operator-owned persisted cache TTL policy |
| `status_check_logs` | Status lookup audit/log records with requester, cache, provider, and error metadata |

## Exposure

Public through `nginx-gateway` under `/api/status/...`.

Gateway route behavior strips `/api/status/`, so service-local routes are:

```text
GET /points/{provider_code}/{external_point_id}/status
POST /points/statuses
GET /points/{provider_code}/{external_point_id}
GET /cache/{provider_code}/{external_point_id}
GET /cache/policy
PATCH /cache/policy
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
- RabbitMQ consumers or queue-drain workers.
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

Expired-cache refreshes use a per-provider/per-point single-flight lock. The
service re-checks cache after acquiring the lock so concurrent lookups for the
same point collapse to one provider call, while different providers/points can
refresh independently.

After each completed status lookup/log write, `status-service` publishes a
best-effort `status.point_checked` analytics event. The event includes provider
code, normalized point id, external point id, normalized result status, cache
hit/provider-called flags, `forceRefresh`, stale fallback state, and user id.
If RabbitMQ publishing fails, the status response behavior is unchanged.

`POST /points/statuses` accepts up to 500 `(provider_code, external_point_id)`
pairs and returns per-point status lookup results plus per-point errors. It
uses the same cache, refresh, authorization, logging, and analytics-event
semantics as the single-point status endpoint. This is the preferred frontend
path when a page needs current status for multiple already-cataloged points.

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

The configured environment value is the documented default. The active TTL is
persisted in `status_cache_policy` and can be read or changed only by an
operator through `GET`/`PATCH /cache/policy`. The minimum accepted TTL is 30
seconds. Updating the policy recalculates `expires_at` for existing cache rows
immediately, so lowering the value does not leave rows valid under an earlier
five-minute expiry. New provider responses use the active policy as well.

## Authorization

`status-service` validates auth-service-compatible HS256 JWT access tokens with
the shared `JWT_SECRET`.

| Endpoint | Access |
|---|---|
| `GET /points/{provider_code}/{external_point_id}/status` | `EV_USER` and `OPERATOR` for any provider; `PROVIDER_ADMIN` only for own provider |
| `POST /points/statuses` | `EV_USER` and `OPERATOR` for any provider; `PROVIDER_ADMIN` only for own provider on every requested point |
| `GET /points/{provider_code}/{external_point_id}` | `EV_USER` and `OPERATOR` for any provider; `PROVIDER_ADMIN` only for own provider |
| `GET /cache/{provider_code}/{external_point_id}` | `EV_USER` and `OPERATOR` for any provider; `PROVIDER_ADMIN` only for own provider; never calls provider services |
| `GET /logs` | `OPERATOR` all logs; `PROVIDER_ADMIN` own provider only; `EV_USER` forbidden |
| `GET /freshness` | Public non-sensitive provider-level metadata |
| `GET /cache/policy` | `OPERATOR` only; active/default/minimum TTL policy |
| `PATCH /cache/policy` | `OPERATOR` only; update active TTL and existing cache expiries |

Provider-admin log responses are provider-scoped and omit direct requester
user IDs, requester emails, raw requester roles, and requester provider claims.
Operators retain the full internal log shape for troubleshooting.

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
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
RABBITMQ_EVENT_EXCHANGE=saasplug.events
RABBITMQ_PUBLISH_TIMEOUT_SECONDS=5
STATUS_RABBITMQ_EVENT_PUBLISH_ENABLED=true
SAASPLUG_STRICT_SECRETS=false
APP_ENV=local
```

The provider-service URLs are Docker-internal service URLs. `status-service`
does not call external provider APIs directly.
When `SAASPLUG_STRICT_SECRETS=true` or `APP_ENV` is production-like, unsafe
placeholder JWT and RabbitMQ credential values are rejected at startup.

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
