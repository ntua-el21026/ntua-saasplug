# Prompt 05 - Provider Services

## 0. Purpose

Implement the MVP baseline for the three provider integration services:

- `red-provider-service`
- `green-provider-service`
- `blue-provider-service`

This prompt must be executed only after Prompt 04 has been reviewed and accepted.

The goal is to replace the current health-only provider-service scaffolds with real provider-adapter baselines that:

1. call the provider-specific external REST API described by each provider OpenAPI YAML file,
2. normalize provider-specific point/status/reservation payloads into common internal DTOs,
3. persist provider-local point snapshots, raw payloads, sync runs, and useful change metadata in each provider service's own PostgreSQL database,
4. expose internal service APIs that later `catalog-service`, `status-service`, and `reservation-service` can call,
5. provide deterministic tests using mocked/fake provider HTTP clients,
6. preserve all existing Docker, gateway, service, data-ownership, and AI-log rules.

Do not implement catalog aggregation, status cache ownership, reservation truth, analytics, billing, frontend screens, RabbitMQ business events, or any new runtime service in this prompt.

---

## 1. Mandatory context

Before changing files, read and follow:

```text
AGENTS.md
docs/specs/SPECIFICATIONS.md
docs/ai/prompts/README.md
docs/ai/codex-runs/_template.md
docs/ai/prompt-log.md
docs/ai/codex-runs/004-provider-registry-service.md
services/provider-registry-service/README.md
services/provider-registry-service/app/routes.py
docker-compose.yml
.env.example
```

Provider contracts are mandatory and authoritative:

```text
docs/assignment/providers/yaml/redPlug.yaml
docs/assignment/providers/yaml/greenPlug.yaml
docs/assignment/providers/yaml/bluePlug.yaml
```

Also inspect the current scaffolds:

```text
services/red-provider-service/
services/green-provider-service/
services/blue-provider-service/
```

If any mandatory file is missing, stop and report the blocker.

---

## 2. Canonical architectural constraints

Follow these constraints strictly:

1. Repository artifacts must be in English.
2. The existing architecture is binding.
3. Do not rename canonical services.
4. Do not create a fourth provider service.
5. Do not create a dedicated orchestrator service.
6. Do not expose provider services through the Nginx gateway.
7. Do not allow frontend-facing direct access to provider services.
8. Do not write to another service's database.
9. Do not query another service's database.
10. Do not implement cross-service SQL joins.
11. Do not store real secrets.
12. Do not create `.env`.
13. Keep `.env.example` placeholder-only.
14. Keep provider API key values external to the repository and referenced only by environment variable names/values at runtime.
15. Use RabbitMQ only if it already exists as infrastructure dependency, but do not implement RabbitMQ business producers/consumers in Prompt 05.
16. Do not modify `docs/specs/SPECIFICATIONS.md` unless the user explicitly approves a SPEC amendment.
17. If GitHub issue/project actions fail, report the failure clearly and do not create fallback Markdown project-management artifacts.

---

## 3. Source-of-truth provider contracts

The OpenAPI YAML files define the provider-specific endpoints and fields. Do not guess provider field names.

### 3.1 redPlug

Base URL comes from:

```text
RED_PROVIDER_BASE_URL
```

OpenAPI contract:

```text
docs/assignment/providers/yaml/redPlug.yaml
```

Provider endpoints:

```text
GET  /points
GET  /point/{pointid}
POST /reserve/{pointid}
POST /reserve/{pointid}/{minutes}
```

Provider point fields include:

```text
pointid
providerName
status
reservationendtime
cap
connector
locationName
address
```

Provider reservation response fields include:

```text
pointid
providerName
status
reservationendtime
```

### 3.2 greenPlug

Base URL comes from:

```text
GREEN_PROVIDER_BASE_URL
```

OpenAPI contract:

```text
docs/assignment/providers/yaml/greenPlug.yaml
```

Provider endpoints:

```text
GET  /chargingPoints
GET  /chargingPoints/{pointid}
POST /chargingPoints/{pointid}/reservations
```

Reservation request body:

```json
{
  "duration": 60
}
```

Provider point fields include:

```text
id
providerName
state
reservedUntil
kwhRateEur
cap
connector
locationName
address
```

Provider reservation response fields include:

```text
id
providerName
state
reservedUntil
kwhRateEur
```

### 3.3 bluePlug

Base URL comes from:

```text
BLUE_PROVIDER_BASE_URL
```

OpenAPI contract:

```text
docs/assignment/providers/yaml/bluePlug.yaml
```

Provider endpoints:

```text
GET  /locations
GET  /location/{pointid}/status
POST /location/{pointid}/hold?minutes=60
```

Provider point fields include:

```text
chargerId
providerName
currentStatus
reservationEnd
pricePerKwh
cap
connector
locationName
address
```

Provider reservation response fields include:

```text
chargerId
providerName
currentStatus
reservationEnd
pricePerKwh
```

---

## 4. Required internal normalized DTOs

Each provider service must expose provider-specific external data through common internal response shapes. The exact Pydantic class names can vary, but the serialized JSON must be stable and documented.

### 4.1 Normalized point DTO

Use this JSON shape for normalized charging points:

```json
{
  "provider_code": "redPlug",
  "external_point_id": "123",
  "normalized_point_id": "redPlug:123",
  "status": "available",
  "reservation_ends_at": null,
  "price_per_kwh_eur": null,
  "capacity": 50,
  "connector": "CCS",
  "location_name": "Example location",
  "address": "Example address",
  "raw_payload": {},
  "last_seen_at": "2026-06-12T00:00:00Z"
}
```

Rules:

- `provider_code` is one of `redPlug`, `greenPlug`, `bluePlug`.
- `external_point_id` is the provider-native point identifier converted to string.
- `normalized_point_id` is exactly `{provider_code}:{external_point_id}`.
- `status` must use the internal enum below.
- `price_per_kwh_eur` may be `null` if the provider does not expose price.
- `raw_payload` may be included for internal diagnostics, but never include secrets.
- Timestamp format should be ISO 8601.

### 4.2 Normalized status enum

Use this internal status set:

```text
available
charging
reserved
malfunction
offline
unknown
```

Map provider-specific status/state/currentStatus values case-insensitively where possible.

If a provider status is missing, unexpected, or not safely mappable, use:

```text
unknown
```

Do not expose raw provider error bodies directly to frontend-facing consumers.

### 4.3 Normalized reservation DTO

Use this JSON shape for normalized reservation responses:

```json
{
  "provider_code": "greenPlug",
  "external_point_id": "123",
  "normalized_point_id": "greenPlug:123",
  "provider_reservation_id": "456",
  "status": "reserved",
  "reservation_ends_at": "2026-06-12T12:00:00Z",
  "price_per_kwh_eur": 0.59,
  "raw_payload": {}
}
```

Rules:

- `provider_reservation_id` may be `null` if the provider does not return one.
- `reservation_ends_at` is required when the provider returns it; otherwise return a clear normalized error.
- Do not store or expose payment information; EV-user payment is out of scope.

### 4.4 Normalized provider error DTO

Use a clear internal error structure for provider failures:

```json
{
  "provider_code": "redPlug",
  "error_type": "provider_timeout",
  "message": "Provider request timed out",
  "external_status_code": null
}
```

Reasonable `error_type` values:

```text
provider_timeout
provider_unavailable
provider_http_error
provider_validation_error
provider_not_found
provider_unexpected_response
```

---

## 5. Required provider-service internal APIs

Implement the same internal API shape in each of the three provider services. These endpoints are for other backend services, not the browser.

Keep `/health` and `/ready`.

Required endpoints, per service:

```text
GET  /internal/provider
GET  /internal/points
POST /internal/sync
GET  /internal/points/{external_point_id}
GET  /internal/points/{external_point_id}/status
POST /internal/points/{external_point_id}/reservations
GET  /internal/sync-runs
```

### 5.1 `GET /internal/provider`

Return basic provider-service identity and runtime config metadata, with no secrets:

```json
{
  "provider_code": "redPlug",
  "service_name": "red-provider-service",
  "api_base_url": "https://...",
  "api_key_env_var": "RED_PROVIDER_API_KEY",
  "secret_configured_elsewhere": true
}
```

### 5.2 `GET /internal/points`

Return provider-local normalized point snapshots from the service-owned database.

Do not call the external provider API from this endpoint unless an explicit query parameter such as `refresh=true` is implemented and documented. The default must be local read.

### 5.3 `POST /internal/sync`

Fetch the provider's list endpoint, store:

- sync run metadata,
- raw payloads,
- normalized point snapshots,
- useful change metadata where simple.

Return a sync summary:

```json
{
  "provider_code": "redPlug",
  "status": "completed",
  "fetched_count": 10,
  "upserted_count": 10,
  "failed_count": 0
}
```

Rules:

- This endpoint may make external provider API calls.
- It must preserve previous local snapshots if sync fails.
- It must record failed sync runs with error messages.
- It must not publish RabbitMQ events in Prompt 05.
- It must not write to `catalog-postgres`.

### 5.4 `GET /internal/points/{external_point_id}`

Fetch a provider point/detail/status as needed using the provider-specific endpoint, normalize it, persist/update the provider-local snapshot, store the raw payload, and return the normalized point DTO.

If the provider detail endpoint is unavailable for a provider, use the closest provider-specific status/detail endpoint defined in the YAML.

### 5.5 `GET /internal/points/{external_point_id}/status`

Fetch current status through the provider API, normalize it to the internal status enum, optionally update the provider-local snapshot, and return a compact status response:

```json
{
  "provider_code": "bluePlug",
  "external_point_id": "123",
  "normalized_point_id": "bluePlug:123",
  "status": "available",
  "reservation_ends_at": null,
  "checked_at": "2026-06-12T00:00:00Z"
}
```

This endpoint does not own the 5-minute cache. The future `status-service` owns caching.

### 5.6 `POST /internal/points/{external_point_id}/reservations`

Make the provider-specific reservation call synchronously and return the normalized reservation DTO.

Request body:

```json
{
  "duration_minutes": 60
}
```

Provider-specific mapping:

- redPlug:
  - if `duration_minutes` is provided, use `POST /reserve/{pointid}/{minutes}`;
  - otherwise, use `POST /reserve/{pointid}`.
- greenPlug:
  - use `POST /chargingPoints/{pointid}/reservations` with JSON body `{ "duration": duration_minutes }`.
- bluePlug:
  - use `POST /location/{pointid}/hold?minutes=duration_minutes`.

Rules:

- Do not create reservation truth tables here.
- Do not publish reservation events here.
- Do not implement billing or analytics.
- Do not queue before the provider call.

### 5.7 `GET /internal/sync-runs`

Return recent sync runs for debugging/demo/operator-support usage.

---

## 6. Required persistence per provider service

Each provider service must use its own PostgreSQL container already defined in `docker-compose.yml`:

```text
red-provider-service   -> red-provider-postgres
green-provider-service -> green-provider-postgres
blue-provider-service  -> blue-provider-postgres
```

Each service must create and use only its own tables. Do not use another service database.

Required tables can be named as appropriate, but must cover:

1. Provider-local point snapshots.
2. Raw provider payloads.
3. Sync runs.
4. Simple provider-local change metadata where useful and not overcomplicated.

Minimum useful columns for point snapshots:

```text
id
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
payload_hash
is_active
last_seen_at
created_at
updated_at
```

Minimum useful columns for raw payloads:

```text
id
provider_code
endpoint
external_point_id
payload
status_code
fetched_at
```

Minimum useful columns for sync runs:

```text
id
provider_code
status
started_at
completed_at
fetched_count
upserted_count
failed_count
error_message
```

Startup table creation is acceptable for MVP, consistent with previous prompts. Alembic migrations remain deferred unless already introduced.

---

## 7. HTTP client requirements

Use a small, testable provider HTTP client per service.

Requirements:

1. Use environment-driven settings:
   - provider base URL,
   - API key env var name,
   - request timeout.
2. Never log or return API key values.
3. If an API key value is present, send it using the provider YAML's optional `authorization` header convention.
4. If no API key value is present, still allow local/demo calls because the YAML marks authorization as optional.
5. Normalize timeouts and HTTP errors into internal provider error DTOs.
6. Tests must not rely on live provider API availability.

Allowed libraries:

- `httpx` for HTTP calls.
- `SQLAlchemy`/`psycopg` for persistence.
- `pytest`/`httpx`/FastAPI test client for tests.
- `Pydantic` for schemas.

Do not add heavyweight frameworks.

---

## 8. Testing requirements

Add tests for each provider service. The tests may share a repeated pattern but must be service-specific enough to verify provider-specific field mappings.

Required tests:

1. Health endpoint remains available.
2. Provider identity endpoint returns safe metadata and no secrets.
3. Provider-specific point payload normalizes correctly:
   - red: `pointid`, `status`, `reservationendtime`.
   - green: `id`, `state`, `reservedUntil`, `kwhRateEur`.
   - blue: `chargerId`, `currentStatus`, `reservationEnd`, `pricePerKwh`.
4. Status values normalize to the internal status enum.
5. Sync stores local snapshots and raw payloads.
6. Failed sync records a failed sync run without deleting previous snapshots.
7. Reservation request maps to the provider-specific endpoint and returns normalized reservation DTO.
8. No test requires real provider network availability.

Preferred command pattern:

```text
docker compose run --rm --no-deps red-provider-service pytest -q
docker compose run --rm --no-deps green-provider-service pytest -q
docker compose run --rm --no-deps blue-provider-service pytest -q
```

If shared tests are used, make sure each provider-specific mapping is still explicitly tested.

---

## 9. Documentation requirements

Update the relevant README files:

```text
README.md
services/red-provider-service/README.md
services/green-provider-service/README.md
services/blue-provider-service/README.md
```

Each provider-service README must document:

1. service responsibility,
2. owned database,
3. provider OpenAPI YAML source,
4. provider-specific external endpoint mapping,
5. internal normalized endpoints,
6. normalized point/status/reservation DTOs,
7. sync behavior,
8. persistence tables,
9. safe secret handling,
10. tests/validation commands,
11. limitations and next-prompt dependencies.

Update `.env.example` only with safe placeholder values if needed.

Update `docker-compose.yml` only as needed for provider-service environment variables, timeouts, and tests.

Do not expose provider services through Nginx.

---

## 10. AI logging requirements

Create or update:

```text
docs/ai/codex-runs/005-provider-services.md
docs/ai/prompt-log.md
```

The run report must use:

```text
docs/ai/codex-runs/_template.md
```

The run report must include:

1. exact invocation prompt,
2. canonical task prompt path,
3. summary of provider-specific mappings implemented,
4. files changed,
5. commands run,
6. tests/checks and results,
7. limitations,
8. GitHub issue/project actions,
9. explicit statement that provider services do not own catalog/status cache/reservation truth/analytics/billing/frontend.

Add a `005` row to `docs/ai/prompt-log.md`.

---

## 11. GitHub issue/project action

After all Prompt 05 acceptance criteria pass:

1. Inspect GitHub issue `#5`.
2. Comment on issue `#5` with the Prompt 05 completion summary and run report path:

```text
docs/ai/codex-runs/005-provider-services.md
```

3. Close issue `#5` as completed.
4. If possible, verify that the corresponding GitHub Project item is `Done`.

If any GitHub action fails:

- report the failure clearly in the Codex final response,
- record it in `docs/ai/codex-runs/005-provider-services.md`,
- do not create fallback Markdown project-management artifacts.

---

## 12. Required validation before final response

Run at minimum:

```text
git diff --check
docker compose config
docker compose run --rm --no-deps red-provider-service pytest -q
docker compose run --rm --no-deps green-provider-service pytest -q
docker compose run --rm --no-deps blue-provider-service pytest -q
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
docker compose down -v
docker compose ps -a
test ! -f .env
```

Also smoke-test provider-service health endpoints internally or through `docker compose exec`/`docker compose run`, since provider services are not exposed through the gateway.

If live external provider APIs are unavailable, do not fail the prompt solely because of that. The deterministic provider-service tests must use mocked/fake HTTP responses.

---

## 13. Explicit non-goals

Do not implement:

- `catalog-service` aggregation,
- catalog viewport/bounds search,
- catalog imports from provider services,
- `status-service` 5-minute cache,
- `reservation-service` reservation truth,
- analytics events or aggregates,
- billing charges/invoices,
- RabbitMQ business publishers or consumers,
- frontend screens,
- provider services exposed via Nginx,
- real secrets,
- `.env`,
- Kubernetes,
- additional databases,
- new runtime services,
- GitHub fallback Markdown project-management artifacts.

---

## 14. Acceptance criteria

Prompt 05 is complete only if:

1. `red-provider-service`, `green-provider-service`, and `blue-provider-service` are no longer health-only scaffolds.
2. Each provider service has provider-specific external endpoint mappings based on its YAML.
3. Each provider service exposes the required internal normalized endpoints.
4. Each provider service stores point snapshots, raw payloads, and sync runs in its own database.
5. Each provider service normalizes point/status/reservation responses into common DTOs.
6. Provider errors are normalized and raw provider error bodies are not exposed directly.
7. Tests pass for all three provider services.
8. Docker Compose config remains valid.
9. The full stack builds and starts.
10. No `.env` file is created.
11. Provider services remain internal-only and are not added to Nginx routes.
12. Documentation is updated.
13. `docs/ai/codex-runs/005-provider-services.md` is created.
14. `docs/ai/prompt-log.md` is updated.
15. GitHub issue `#5` is closed as completed if GitHub actions succeed.
16. No out-of-scope domains are implemented.

---

## 15. Final response format

Return a concise final report with:

1. final status,
2. files created,
3. files modified,
4. validation commands and results,
5. GitHub issue/project status,
6. warnings/limitations,
7. confirmation that no out-of-scope business domains were implemented,
8. next recommended action: Prompt 06 for `catalog-service`.
