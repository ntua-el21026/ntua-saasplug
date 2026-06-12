# Prompt 07 - Status Service

## Purpose

Implement the `status-service` MVP scope for the saasPlug project.

This prompt must be executed only after Prompt 06 has been reviewed and accepted. Prompt 06 implemented `catalog-service`; Prompt 07 must now implement the service that owns live status lookup behavior, the 5-minute status cache, status check logs, timeout fallback behavior, and role-gated status-log access.

The discussion with the user may be in Greek, but **all repository files, code, comments, documentation, README files, Codex prompts, and AI logs must remain in English**.

## Mandatory canonical context

Before making changes, read at least:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/prompt-log.md

docs/ai/codex-runs/003-auth-service.md
docs/ai/codex-runs/004-provider-registry-service.md
docs/ai/codex-runs/005-provider-services.md
docs/ai/codex-runs/006-catalog-service.md

services/auth-service/README.md
services/auth-service/app/security.py
services/auth-service/app/schemas.py
services/provider-registry-service/README.md
services/catalog-service/README.md
services/catalog-service/app/schemas.py
services/catalog-service/app/routes.py

services/red-provider-service/README.md
services/red-provider-service/app/schemas.py
services/red-provider-service/app/routes.py
services/green-provider-service/README.md
services/green-provider-service/app/schemas.py
services/green-provider-service/app/routes.py
services/blue-provider-service/README.md
services/blue-provider-service/app/schemas.py
services/blue-provider-service/app/routes.py

docker-compose.yml
deploy/nginx/default.conf
.env.example
```

Also inspect the current `status-service` scaffold:

```text
services/status-service/
```

Treat `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` as canonical. If anything else conflicts with them, follow those two files.

## Accepted architecture constraints

Preserve the accepted architecture:

1. `status-service` owns:
   - 5-minute status cache,
   - status check logs,
   - last-known status,
   - fallback behavior for timeouts/provider failures,
   - status lookup through provider services when cache expires,
   - optional status analytics events later, but **not in this prompt**.

2. Status lookup flow must be:

```text
frontend -> nginx-gateway -> status-service -> status-postgres cache -> provider service if expired -> external provider API
```

3. `status-service` must **not** call external provider APIs directly.

4. `status-service` may call only the Docker-internal provider services:

```text
red-provider-service:8000
green-provider-service:8000
blue-provider-service:8000
```

5. Provider services must remain internal-only. Do not expose provider services through Nginx.

6. The frontend must continue to call only gateway paths.

7. RabbitMQ must not be used for live status lookup. Do not add status RabbitMQ publishers/consumers in this prompt; RabbitMQ event infrastructure is later Prompt 09 scope.

8. Do not implement catalog aggregation, reservation truth, analytics, billing, frontend screens, or provider adapters in this prompt.

## Required behavior

### 1. Runtime configuration

Implement environment-driven settings for `status-service`.

Required safe defaults:

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

Add safe placeholder entries to `.env.example` if missing.

Update `docker-compose.yml` so `status-service` receives:

- `JWT_SECRET`,
- `STATUS_CACHE_TTL_SECONDS`,
- `STATUS_PROVIDER_TIMEOUT_SECONDS`,
- internal provider-service URLs.

Do not create `.env`.

### 2. Persistence

Implement local SQLAlchemy persistence in `status-postgres`.

MVP startup table creation is acceptable, consistent with previous prompts. Do not introduce Alembic unless the existing repo already has a shared migration pattern.

Create status-owned tables equivalent to:

#### `status_cache`

Must store at least:

- `id`,
- `provider_code`,
- `external_point_id`,
- `normalized_point_id`,
- `status`,
- `reservation_ends_at`, nullable,
- `last_checked_at`,
- `expires_at`,
- `source`, e.g. `provider_live`, `cache`, `cache_fallback`,
- `raw_provider_payload`, JSON/dict,
- `last_error_type`, nullable,
- `last_error_message`, nullable,
- `created_at`,
- `updated_at`.

Use a unique logical key on:

```text
(provider_code, external_point_id)
```

The normalized point ID must follow the accepted format:

```text
provider_code:external_point_id
```

#### `status_check_logs`

Must store at least:

- `id`,
- `provider_code`,
- `external_point_id`,
- `normalized_point_id`,
- `requested_by_user_id`, nullable,
- `requested_by_email`, nullable,
- `requested_by_roles`, JSON/list,
- `requested_by_provider_code`, nullable,
- `cache_hit`, boolean,
- `force_refresh`, boolean,
- `result_status`, nullable,
- `returned_stale`, boolean,
- `provider_called`, boolean,
- `provider_error_type`, nullable,
- `provider_error_message`, nullable,
- `external_status_code`, nullable,
- `checked_at`.

### 3. Status cache policy

Implement a 5-minute cache by default:

```text
STATUS_CACHE_TTL_SECONDS=300
```

Status lookup rules:

1. If cache exists and `expires_at > now` and `forceRefresh=false`, return cached status.
2. If cache is missing, expired, or `forceRefresh=true`, call the correct provider service internal endpoint:

```text
GET /internal/points/{external_point_id}/status
```

3. On provider success:
   - normalize/validate the provider-service response,
   - update `status_cache`,
   - set new `expires_at = now + ttl`,
   - write a `status_check_logs` record,
   - return a response with `cache_hit=false`, `provider_called=true`, `returned_stale=false`.

4. On provider timeout/error with previous cached status available:
   - do not fail the user request,
   - return last known status,
   - mark response as stale/fallback,
   - include a non-sensitive warning,
   - update/log the provider error,
   - write a `status_check_logs` record.

5. On provider timeout/error with no previous cached status:
   - return a normalized non-500 application error, usually HTTP `502 Bad Gateway`,
   - do not expose raw external provider error bodies,
   - write a failed `status_check_logs` record.

6. Missing/unknown provider status must normalize to:

```text
unknown
```

Use the accepted normalized status enum:

```text
available
charging
reserved
malfunction
offline
unknown
```

### 4. Provider-service client

Implement a small internal provider-service client for `status-service`.

It must:

- resolve provider service URL by `provider_code`,
- reject unknown provider codes,
- call only internal provider-service URLs,
- use configured timeout,
- parse provider-service normalized `StatusResponse`,
- handle provider-service HTTP errors and invalid payloads as normalized internal errors.

Do not duplicate provider-specific external API logic. Provider-specific mapping remains owned by `red-provider-service`, `green-provider-service`, and `blue-provider-service`.

### 5. API endpoints

Expose status-service endpoints through the existing gateway route:

```text
/api/status/* -> status-service
```

Because Nginx strips `/api/status/`, service-local routes should be defined accordingly.

Implement at least:

```text
GET /health
GET /ready
GET /points/{provider_code}/{external_point_id}
GET /points/{provider_code}/{external_point_id}/status
GET /cache/{provider_code}/{external_point_id}
GET /logs
GET /freshness
```

Suggested semantics:

#### `GET /points/{provider_code}/{external_point_id}/status`

Main status lookup endpoint.

Query params:

```text
forceRefresh=false
```

Returns a structured response with at least:

```json
{
  "provider_code": "redPlug",
  "external_point_id": "123",
  "normalized_point_id": "redPlug:123",
  "status": "available",
  "reservation_ends_at": null,
  "checked_at": "...",
  "expires_at": "...",
  "cache_hit": false,
  "provider_called": true,
  "returned_stale": false,
  "source": "provider_live",
  "warning": null
}
```

#### `GET /points/{provider_code}/{external_point_id}`

May be an alias of `/status` for frontend convenience.

#### `GET /cache/{provider_code}/{external_point_id}`

Returns cached status only. It must not call provider services. If no cache exists, return `404`.

#### `GET /logs`

Role-gated status check log listing.

- `OPERATOR`: can see all logs.
- `PROVIDER_ADMIN`: can see logs only for their own `provider_code`.
- `EV_USER`: forbidden.

Support filters:

```text
providerCode
externalPointId
limit
```

#### `GET /freshness`

Returns non-sensitive cache/log freshness information per provider. This may be public or auth-protected; choose the simpler behavior consistent with existing service style and document it clearly.

### 6. Authorization

Use auth-service-compatible JWT validation using the same `JWT_SECRET` approach already used in `catalog-service` and `provider-registry-service`.

Authorization rules:

1. Status lookup may be available to any authenticated role:
   - `EV_USER`,
   - `PROVIDER_ADMIN`,
   - `OPERATOR`.

2. `PROVIDER_ADMIN` may check live status for any point only if this is necessary for EV-like behavior; however provider-admin log access must be scoped to their own provider. Prefer simple and strict behavior:
   - EV/user-facing status lookup: any authenticated user can query any point.
   - management/log listing: provider admins are scoped to own provider.

3. Log listing must be role-gated as described above.

4. Do not call auth-service at runtime for token validation; decode locally using shared JWT secret, as previous services do.

### 7. Documentation

Update:

```text
README.md
services/status-service/README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/006-catalog-service.md only if you discover a factual correction is needed; otherwise do not modify old run logs.
```

Create/update:

```text
docs/ai/codex-runs/007-status-service.md
```

The service README must document:

- service ownership,
- status cache TTL,
- fallback behavior,
- endpoints,
- auth rules,
- provider-service dependency,
- tests,
- limitations/non-goals.

### 8. Tests

Add deterministic tests under:

```text
services/status-service/tests/test_status_service_api.py
```

Tests must not require live external provider APIs.

Use a fake provider-service client or monkeypatch HTTP calls.

Cover at least:

1. health endpoint still works,
2. first lookup on cache miss calls provider and stores cache,
3. second lookup within TTL returns cache without provider call,
4. expired cache triggers provider refresh,
5. `forceRefresh=true` bypasses valid cache,
6. provider failure with previous cache returns stale fallback,
7. provider failure without cache returns normalized 502,
8. provider-admin log access is scoped to own provider,
9. EV user cannot list logs,
10. unknown provider code returns a client error,
11. invalid/missing JWT is rejected where auth is required,
12. freshness endpoint returns provider-level metadata.

### 9. Validation commands

Run and record results in the run report:

```text
git diff --check
docker compose config
docker compose run --rm --no-deps status-service pytest -q
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/status/health
```

Also run at least one deterministic gateway smoke using local seeded auth credentials where practical:

1. login through auth-service,
2. call a status-service endpoint through `/api/status/...`,
3. verify cache/log/freshness route behavior.

Do not print JWTs or secrets in logs/output.

End with:

```text
docker compose down -v
docker compose ps -a
test ! -f .env
```

### 10. GitHub issue/project management

After all Prompt 07 acceptance criteria pass:

1. Inspect GitHub issue `#7`.
2. Add a completion comment referencing:

```text
docs/ai/codex-runs/007-status-service.md
```

3. Close issue `#7` as completed.
4. If possible, verify or update the GitHub Project item for issue `#7` to `Done`.

If GitHub issue/project mutations fail:

- report the failure clearly in the Codex final response,
- record it in `docs/ai/codex-runs/007-status-service.md`,
- do not create fallback Markdown project-management artifacts.

### 11. Non-goals for this prompt

Do **not** implement:

- frontend screens,
- catalog aggregation/imports/search changes,
- reservation-service reservation truth,
- reservation provider calls through reservation-service,
- analytics-service ingestion or dashboards,
- billing-service charges/invoices,
- RabbitMQ business consumers/publishers,
- provider-service Nginx exposure,
- direct external provider API calls from `status-service`,
- real secrets or `.env`,
- new runtime services,
- database schemas outside `status-service` ownership.

### 12. Acceptance criteria

Prompt 07 is acceptable only if:

1. `status-service` owns local status cache and status-check logs.
2. Cache TTL defaults to 5 minutes and is configurable.
3. Cache miss/expired/force-refresh paths call only provider services, never external provider APIs directly.
4. Cached status is returned when valid.
5. Last-known cached status is returned with warning when provider lookup fails and cache exists.
6. Provider failure without cache returns a normalized non-500 application error response.
7. Status lookup logs are persisted.
8. Operator/provider-admin log access works with provider scoping.
9. Deterministic tests pass without live provider APIs.
10. `docker compose config` passes.
11. Full stack starts healthy.
12. Gateway `/api/status/health` works.
13. `.env` is not created.
14. Documentation and AI logs are updated.
15. GitHub issue `#7` is closed as completed, or any mutation failure is reported clearly.

## Final response expected from Codex

Return a concise final summary with:

1. final status: `COMPLETED` or `COMPLETED_WITH_WARNINGS`,
2. files created,
3. files modified,
4. validation results,
5. GitHub issue/project result,
6. warnings/blockers,
7. explicit next recommended action: Prompt 08 for `reservation-service`.
