# Prompt 08 - Reservation Service

## Invocation context

You are implementing Prompt 08 for the NTUA ECE course project `saasPlug`.

Read and obey, in this order:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. `docs/ai/prompts/README.md`
4. `docs/ai/codex-runs/_template.md`
5. Prior run reports, especially:
   - `docs/ai/codex-runs/005-provider-services.md`
   - `docs/ai/codex-runs/006-catalog-service.md`
   - `docs/ai/codex-runs/007-status-service.md`
6. Existing service READMEs and code for:
   - `auth-service`
   - `provider-registry-service`
   - `red-provider-service`
   - `green-provider-service`
   - `blue-provider-service`
   - `catalog-service`
   - `status-service`
   - `reservation-service`
7. Provider OpenAPI specs under:
   - `docs/assignment/providers/yaml/redPlug.yaml`
   - `docs/assignment/providers/yaml/greenPlug.yaml`
   - `docs/assignment/providers/yaml/bluePlug.yaml`

All repository files, code comments, documentation, run reports, and prompt-log entries must be written in English.

## Current state before this prompt

Prompts 01-05 are completed. Prompts 06 and 07 are completed with warnings only because live external provider endpoints returned HTTP 403 with local placeholder credentials. Deterministic tests cover the success paths.

The current implemented baseline includes:

- Docker Compose stack with Nginx gateway and one PostgreSQL container per stateful service.
- `auth-service` with JWT, seeded users, roles, provider scoping, and Google OAuth hooks.
- `provider-registry-service` with seeded providers and safe config metadata.
- `red-provider-service`, `green-provider-service`, and `blue-provider-service` with provider-specific mappings, normalized DTOs, local snapshots, raw payloads, sync runs, and internal reservation/status endpoints.
- `catalog-service` with aggregated normalized catalog, cached point details, provider imports, bounds/search queries, freshness, and import runs.
- `status-service` with 5-minute cache, status lookup logs, provider-service lookup, stale fallback, and role-gated logs.
- `reservation-service` is still a health-only scaffold.

## Goal

Implement only the `reservation-service` MVP baseline.

`reservation-service` owns reservation truth. It must implement the synchronous reservation flow:

```text
frontend -> nginx-gateway -> reservation-service -> provider service -> external provider API
```

It must resolve/validate the point through `catalog-service`, call the correct provider service synchronously, store successful and failed/unknown reservation attempts, and stage reservation events for later RabbitMQ publishing without implementing RabbitMQ publishing in this prompt.

## Architecture constraints

### Must follow

- `reservation-service` owns reservation records and successful/failed reservation attempts.
- Reservation provider calls are synchronous and must not be queued before the provider call.
- `reservation-service` must not call external provider APIs directly.
- `reservation-service` must call provider services through Docker-internal service URLs only.
- `reservation-service` must not read or write another service's database.
- Point/provider resolution must happen through `catalog-service` HTTP endpoints, not through catalog DB access.
- JWT validation must be compatible with `auth-service` access tokens.
- EV users can create and view their own reservations.
- Provider admins can view reservations scoped to their own provider.
- Operators can view all reservations and attempts.
- Raw provider errors must not be returned directly to users.

### Must not implement

Do not implement any of the following in Prompt 08:

- frontend screens;
- catalog aggregation/import/search changes;
- status-service cache changes;
- analytics-service logic;
- billing-service logic;
- RabbitMQ exchange/queues/consumers/publishers;
- actual event publishing to RabbitMQ;
- provider services exposed through Nginx;
- direct external provider API calls from `reservation-service`;
- real secrets or `.env` files;
- new runtime services;
- database schemas outside `reservation-service` ownership;
- cancellation, refunds, partial payments, real EV charging payments, or invoice generation.

## Required behavior

### 1. Service structure

Replace the health-only `reservation-service` scaffold with a proper FastAPI app while preserving:

```text
GET /
GET /health
GET /ready
```

Create the reservation-service implementation under:

```text
services/reservation-service/app/
```

Use the same style already established by `auth-service`, `provider-registry-service`, `catalog-service`, and `status-service`:

```text
config.py
database.py
models.py
schemas.py
security.py
catalog_client.py
provider_client.py
reservation_logic.py
routes.py
```

You may adjust file names if a better local structure is clearly justified, but keep the implementation simple and reviewable.

### 2. Owned persistence

Use `reservation-postgres` through SQLAlchemy.

Create reservation-service-owned tables for at least:

1. `reservations`
2. `reservation_attempts`
3. `reservation_event_outbox`

Alembic migrations remain deferred unless the existing repository has already adopted Alembic globally. Follow the current MVP startup table-creation style used by prior services.

Suggested minimum `reservations` fields:

- `id` UUID string primary key
- `user_id`
- `user_email`
- `provider_code`
- `external_point_id`
- `normalized_point_id`
- `catalog_point_id` nullable
- `requested_duration_minutes`
- `status` with values such as `succeeded`, `failed`, `unknown`
- `provider_reservation_id` nullable
- `provider_status` nullable
- `reservation_ends_at` nullable
- `price_per_kwh_eur` nullable
- `failure_reason` nullable
- `created_at`
- `updated_at`

Suggested minimum `reservation_attempts` fields:

- `id` UUID string primary key
- `reservation_id` nullable until a reservation record exists
- `user_id`
- `user_email`
- `provider_code`
- `external_point_id`
- `normalized_point_id`
- `requested_duration_minutes`
- `result_status`
- `provider_called`
- `provider_error_type` nullable
- `provider_error_message` nullable
- `external_status_code` nullable
- `started_at`
- `completed_at` nullable

Suggested minimum `reservation_event_outbox` fields:

- `id` UUID string primary key
- `event_type`, e.g. `reservation.succeeded`, `reservation.failed`
- `aggregate_id`, normally the reservation ID
- `provider_code`
- `user_id`
- `payload` JSON
- `publish_status`, default `pending`
- `created_at`

The event outbox is only staged data in Prompt 08. Do not publish to RabbitMQ yet.

### 3. Catalog resolution

Before calling the provider service, resolve the target point through `catalog-service` using Docker-internal HTTP.

Use existing catalog behavior where possible:

```text
GET http://catalog-service:8000/points/{provider_code}/{external_point_id}
```

The reservation flow must reject missing, inactive, or stale catalog points with a clear client-facing error. Do not trigger catalog imports from `reservation-service`.

### 4. Provider reservation call

Call the correct internal provider service endpoint synchronously:

```text
POST http://red-provider-service:8000/internal/points/{external_point_id}/reservations
POST http://green-provider-service:8000/internal/points/{external_point_id}/reservations
POST http://blue-provider-service:8000/internal/points/{external_point_id}/reservations
```

Request body:

```json
{
  "duration_minutes": 60
}
```

The provider services already normalize provider-specific responses into a common reservation DTO shape. Reuse that shape; do not reimplement external provider-specific mapping in `reservation-service`.

### 5. API endpoints

Expose reservation-service endpoints under the service root. Through the gateway they will be reachable under `/api/reservations/...`.

Required endpoints:

```text
POST /points/{provider_code}/{external_point_id}/reservations
GET  /reservations/me
GET  /reservations
GET  /reservations/{reservation_id}
GET  /reservations/{reservation_id}/attempts
GET  /attempts
GET  /events/outbox
```

Recommended access rules:

- `POST /points/{provider_code}/{external_point_id}/reservations`
  - Requires authenticated user.
  - Intended for `EV_USER`; `OPERATOR` may also be allowed for testing/admin if documented.
  - `PROVIDER_ADMIN` should not create EV-user reservations unless explicitly justified.

- `GET /reservations/me`
  - EV users see only their own reservations.

- `GET /reservations`
  - Operators see all.
  - Provider admins see only reservations for their `provider_code`.
  - EV users should either be forbidden or redirected conceptually to `/reservations/me`; keep behavior explicit and tested.

- `GET /reservations/{reservation_id}`
  - EV user sees own reservation.
  - Provider admin sees own-provider reservation.
  - Operator sees all.

- `GET /reservations/{reservation_id}/attempts`
  - Operator sees all.
  - Provider admin sees own-provider attempts.
  - EV user sees attempts only for their own reservation, if exposed.

- `GET /attempts`
  - Operator/provider-admin role-gated.
  - Provider admins scoped to own provider.

- `GET /events/outbox`
  - Operator-only debug/verification endpoint for pending staged events.
  - Do not publish these events in Prompt 08.

All endpoints must return safe, non-secret JSON only.

### 6. Reservation result handling

On provider success:

- Store a reservation record with status `succeeded`.
- Store a successful attempt.
- Store a pending outbox event with type `reservation.succeeded`.
- Return a normalized reservation response.

On provider failure or timeout:

- Store a failed or unknown reservation record/attempt where practical.
- Store a pending outbox event with type `reservation.failed` if a reservation record is created.
- Return a clear normalized error response.
- Do not expose raw provider error bodies.
- Do not retry indefinitely.

For timeout/ambiguous provider outcomes, use status `unknown` and a clear message.

### 7. Authentication and authorization

Implement JWT validation compatible with `auth-service`.

Use claims already established in prior prompts:

```text
sub
email
roles
provider_id
provider_code
exp
```

Expected roles:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

Tests must cover role access rules and provider-admin scoping.

### 8. Configuration

Add safe placeholders to `.env.example` and `docker-compose.yml` only as needed.

Expected environment variables:

```text
JWT_SECRET
RESERVATION_CATALOG_SERVICE_URL=http://catalog-service:8000
RESERVATION_PROVIDER_TIMEOUT_SECONDS=5
RED_PROVIDER_SERVICE_URL=http://red-provider-service:8000
GREEN_PROVIDER_SERVICE_URL=http://green-provider-service:8000
BLUE_PROVIDER_SERVICE_URL=http://blue-provider-service:8000
```

Do not create `.env`.

### 9. Tests

Create deterministic tests under:

```text
services/reservation-service/tests/test_reservation_service_api.py
```

Tests must not require live external provider APIs.

Use fake/mocked catalog and provider clients or dependency injection to test:

1. health endpoint remains available;
2. EV user can create a successful reservation;
3. reservation creation resolves the point through catalog-service client;
4. provider-service reservation is called synchronously;
5. successful reservation stores reservation, attempt, and pending outbox event;
6. provider failure stores failed/unknown attempt and returns normalized error;
7. missing/stale/inactive catalog point rejects reservation before provider call;
8. EV user can list only own reservations;
9. provider admin can list only own-provider reservations;
10. provider admin cannot see another provider's reservations;
11. operator can list all reservations and attempts;
12. outbox endpoint is operator-only;
13. no raw provider error body or secret is returned.

The exact number of tests may differ, but coverage must include success, failure, persistence, auth, and scoping.

### 10. Validation commands

Run and record at least:

```bash
docker compose run --rm --no-deps reservation-service pytest -q
git diff --check
docker compose config
docker compose up -d --build
docker compose ps
curl -fsS http://localhost:8080/health
curl -fsS http://localhost:8080/api/reservations/health
docker compose down -v
docker compose ps -a
test ! -f .env
```

Also perform a gateway smoke check for reservation-service where practical.

Do not require a successful live reservation against professor/provider endpoints when local provider credentials are placeholders. If live provider reservation returns HTTP 403 through a provider service, treat it as an environment-limited warning only if deterministic tests pass and the service records the failure safely.

### 11. Documentation updates

Update at least:

```text
README.md
services/reservation-service/README.md
docs/ai/prompt-log.md
docs/ai/codex-runs/007-status-service.md only if needed for typo correction; otherwise do not modify prior run reports
docs/ai/codex-runs/008-reservation-service.md
```

Do not modify `docs/specs/SPECIFICATIONS.md` unless a contradiction is found and the user explicitly approves a SPEC amendment. If a contradiction is found, stop and report it.

### 12. AI run log

Create:

```text
docs/ai/codex-runs/008-reservation-service.md
```

Use:

```text
docs/ai/codex-runs/_template.md
```

The run report must include:

- exact invocation prompt;
- canonical prompt file path;
- canonical sources read;
- files created/modified;
- commands run;
- tests/checks and results;
- warnings/limitations;
- GitHub issue/project actions;
- final status.

Update:

```text
docs/ai/prompt-log.md
```

Add run `008` with status `completed` or `completed_with_warnings`, as appropriate.

### 13. GitHub issue/project action

After all Prompt 08 acceptance criteria pass:

1. Inspect GitHub issue `#8`.
2. Add a completion comment referencing:

```text
docs/ai/codex-runs/008-reservation-service.md
```

3. Close issue `#8` as completed.
4. If possible, verify or update the GitHub Project item for issue `#8` to `Done`.

If GitHub issue/project mutations fail:

- report the failure clearly in the Codex final response;
- record the failure in `docs/ai/codex-runs/008-reservation-service.md`;
- do not create fallback Markdown project-management artifacts.

## Acceptance criteria

Prompt 08 is acceptable only if:

- `reservation-service` is no longer health-only;
- reservation-service owns its own persistence in `reservation-postgres`;
- reservations are created through synchronous provider-service calls;
- point validation/resolution happens through `catalog-service`, not through direct DB access;
- successful reservations store reservation records, attempts, and pending outbox events;
- failed/unknown attempts are stored and return safe normalized errors;
- role and provider scoping are enforced;
- deterministic tests pass in Docker;
- Docker Compose validates and the full stack becomes healthy;
- gateway health for reservation-service passes;
- `.env` is not created;
- no raw secrets or raw provider errors are exposed;
- no out-of-scope services or RabbitMQ publishers/consumers are implemented;
- `docs/ai/prompt-log.md` and `docs/ai/codex-runs/008-reservation-service.md` are updated;
- GitHub issue `#8` is handled as requested, or failures are reported clearly.
