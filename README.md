# saasPlug

saasPlug is the NTUA ECE Technologies of Software Services course project for
academic year 2025-2026. It is a SaaS web application for EV charging point
discovery, reservation, provider analytics, billing, and operator
administration.

> Prompt 02 baseline status: Docker Compose, Nginx gateway, service
> containers, database containers, RabbitMQ, and health endpoints are present.
> Prompt 03 auth status: `auth-service` has local persistence, seeded demo
> users, email/password login, JWT access tokens, refresh tokens, role/provider
> scope helpers, and safe Google OAuth hook endpoints.
> Prompt 04 provider-registry status: `provider-registry-service` has local
> persistence, seeded canonical providers, role/provider-scoped JWT
> authorization, safe integration configuration metadata, and provider config
> audit logs.
> Prompt 05 provider-service status: `red-provider-service`,
> `green-provider-service`, and `blue-provider-service` have provider-specific
> API mappings, normalized internal DTOs, provider-local persistence, raw
> payload storage, sync runs, internal endpoints, and deterministic tests.
> Prompt 06 catalog-service status: `catalog-service` owns aggregated catalog
> persistence, imports normalized provider-service snapshots, supports full
> upsert/change detection, stale/inactive handling, viewport/bounds point
> queries, cached point details, freshness metadata, import run records, and
> deterministic tests.
> Prompt 07 status-service status: `status-service` owns a configurable
> 5-minute status cache, status check logs, provider-service status lookups,
> timeout/error fallback to last known cached status, role-gated log access,
> freshness metadata, and deterministic tests.
> Prompt 08 reservation-service status: `reservation-service` owns reservation
> truth, resolves points through `catalog-service`, calls provider services
> synchronously, stores successful/failed/unknown attempts, stages reservation
> outbox events, enforces JWT role/provider scoping, and has deterministic
> tests.
> Prompt 09 event-infrastructure status: `packages/events` defines the common
> event envelope, routing keys, topology and DLQ declarations, publisher,
> consumer, and idempotency primitives; `reservation-service` can publish
> pending reservation outbox events to RabbitMQ through an operator endpoint.
> Prompt 10 analytics-service status: `analytics-service` owns raw usage event
> ingestion, idempotent event storage, RabbitMQ analytics queue draining,
> precomputed aggregate/cache tables, provider/operator analytics endpoints,
> usage CSV export, JWT role/provider scoping, and deterministic tests.
> Prompt 11 billing-service status: `billing-service` owns pricing rules,
> charge records, invoices, invoice lines, mock full-invoice payments, billing
> event ingestion, RabbitMQ billing queue draining, billing outbox publishing,
> JWT role/provider scoping, and deterministic tests.
> Frontend product screens are not implemented yet.

## Project Overview

saasPlug integrates three hypothetical charging infrastructure providers:

- `redPlug`
- `greenPlug`
- `bluePlug`

EV users search for charging points, inspect status, and reserve chargers.
Provider administrators inspect their own points, analytics, invoices, payment
state, exports, and limited settings. Operators manage providers, pricing,
sync, invoices, and system status.

## Architecture Summary

The accepted MVP architecture is a Dockerized microservices application:

- one React + TypeScript + Vite frontend app,
- an Nginx API gateway/reverse proxy,
- Python FastAPI backend services,
- REST/JSON internal APIs,
- RabbitMQ topic exchange `saasplug.events` for asynchronous propagation,
- one PostgreSQL container per stateful service,
- PlantUML diagrams for final documentation.

Frontend code must call only `/api/...` gateway routes. It must not call
internal service ports or provider APIs directly.

## Canonical Services

```text
frontend
nginx-gateway
auth-service
provider-registry-service
red-provider-service
green-provider-service
blue-provider-service
catalog-service
status-service
reservation-service
analytics-service
billing-service
rabbitmq
```

## Canonical Database Containers

| Service | Database container |
|---|---|
| `auth-service` | `auth-postgres` |
| `provider-registry-service` | `provider-registry-postgres` |
| `red-provider-service` | `red-provider-postgres` |
| `green-provider-service` | `green-provider-postgres` |
| `blue-provider-service` | `blue-provider-postgres` |
| `catalog-service` | `catalog-postgres` |
| `status-service` | `status-postgres` |
| `reservation-service` | `reservation-postgres` |
| `analytics-service` | `analytics-postgres` |
| `billing-service` | `billing-postgres` |

## Repository Layout

| Path | Purpose |
|---|---|
| `apps/` | User-facing applications |
| `services/` | FastAPI microservices |
| `packages/` | Shared contracts and helper packages |
| `deploy/` | Deployment and gateway files |
| `docs/` | Specifications, diagrams, assignment material, AI logs |
| `scripts/` | Repository utility scripts |

## Local Development Baseline

Use `.env.example` as the safe configuration template. Do not commit a real
`.env` file.

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
```

Expected baseline health checks:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/provider-registry/health
curl http://localhost:8080/api/providers/health
curl http://localhost:8080/api/catalog/health
curl http://localhost:8080/api/status/health
curl http://localhost:8080/api/reservations/health
curl http://localhost:8080/api/analytics/health
curl http://localhost:8080/api/billing/health
```

Auth-service local demo endpoints are available through the gateway under
`/api/auth/auth/...` because the gateway maps `/api/auth/` to the service root:

```bash
curl -X POST http://localhost:8080/api/auth/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@saasplug.local","password":"change-me-demo-password"}'

curl http://localhost:8080/api/auth/auth/me \
  -H "Authorization: Bearer <access-token>"
```

The local demo users are:

| Email | Role | Provider scope |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

The safe local demo password is controlled by `DEMO_USER_PASSWORD` in
`.env.example`. Change it in your uncommitted `.env` for local use.

Provider-registry endpoints are available through the gateway under
`/api/providers/providers...` because the gateway maps `/api/providers/` to the
service root:

```bash
curl http://localhost:8080/api/providers/providers \
  -H "Authorization: Bearer <access-token>"

curl http://localhost:8080/api/providers/providers/redPlug/integration-config \
  -H "Authorization: Bearer <access-token>"
```

Stop the baseline and remove local development volumes with:

```bash
docker compose down -v
```

The `-v` flag deletes local PostgreSQL and RabbitMQ volumes. Use it only when a
fresh local baseline is intended.

## Prompt 02 Scope

Implemented:

- `docker-compose.yml` with canonical container names.
- Nginx gateway on host port `8080`.
- RabbitMQ with management UI on host port `15672`.
- One PostgreSQL container per stateful service, using named volumes.
- Minimal FastAPI `/`, `/health`, and `/ready` endpoints for each backend
  service.
- Minimal Vite frontend placeholder on internal port `5173`.

Still not implemented by Prompt 02:

- provider adapters or provider API calls,
- catalog sync, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, schemas, migrations, seed data, or frontend product
  screens.

## Prompt 03 Scope

Implemented:

- `auth-service` local table creation for MVP development.
- Hashed password storage.
- Idempotent seeded demo users.
- JSON email/password register and login.
- JWT access tokens with `sub`, `email`, `roles`, `provider_id`,
  `provider_code`, and `exp`.
- Hashed persisted refresh tokens with logout revocation.
- `/auth/me`, `/auth/require-operator`, and
  `/auth/require-provider-admin` verification endpoints.
- Safe Google OAuth login/callback hooks that return clear local-demo JSON when
  credentials are placeholders.

Not implemented yet:

- frontend login screens,
- real Google token exchange,
- provider-registry business logic,
- provider adapters or provider API calls,
- catalog sync, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, or frontend product screens.

Prompt 04 implements the `provider-registry-service` baseline described below.

## Prompt 04 Scope

Implemented:

- `provider-registry-service` local table creation for MVP development.
- Idempotent seed data for `redPlug`, `greenPlug`, and `bluePlug`.
- Provider metadata, activation status, safe integration-config, and audit-log
  JSON endpoints.
- JWT bearer authorization using `auth-service` token claims and shared
  `JWT_SECRET`.
- Operator access for all providers and provider-admin access scoped to the
  provider in the token.
- Safe secret handling that stores and returns only environment-variable names,
  never raw provider API keys.

Still not implemented:

- catalog sync/search, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, or frontend product screens.

Prompt 05 implements the provider-service baselines described below.

## Prompt 05 Scope

Implemented:

- `red-provider-service`, `green-provider-service`, and
  `blue-provider-service` adapter baselines.
- Provider-specific list/detail/status/reservation endpoint mappings based on
  `redPlug.yaml`, `greenPlug.yaml`, and `bluePlug.yaml`.
- Common normalized point, status, reservation, and provider-error DTOs.
- Provider-local point snapshots, raw provider payloads, sync runs, and simple
  point-change metadata in each provider service database.
- Internal-only provider endpoints under `/internal/...`.
- Deterministic fake-provider tests for all three provider services.
- Safe API-key handling that sends optional provider keys through the provider
  `authorization` header at runtime but never returns raw key values.

Still not implemented:

- `reservation-service` reservation truth and reservation events,
- analytics, billing, RabbitMQ business consumers, or frontend product screens.

Prompt 06 implements the `catalog-service` baseline described below.

## Prompt 06 Scope

Implemented:

- `catalog-service` local table creation for aggregated normalized catalog
  points, import runs, and point-change records.
- Operator-only imports from internal provider-service endpoints:
  `POST /internal/sync` and `GET /internal/points`.
- Full upsert/change detection keyed by `provider_code:external_point_id`.
- Stale/inactive handling for provider points missing from the latest import.
- Gateway-facing catalog endpoints:
  `GET /api/catalog/points`,
  `GET /api/catalog/points/{provider_code}/{external_point_id}`,
  `POST /api/catalog/imports/providers/{provider_code}`,
  `POST /api/catalog/imports/all`,
  `GET /api/catalog/imports/runs`, and
  `GET /api/catalog/freshness`.
- Viewport/bounds point queries with sane limits and optional filters.
- Cached point details from local catalog rows only.
- Public non-sensitive freshness metadata.
- Deterministic fake-provider tests for catalog import and query behavior.

Provider APIs do not expose coordinates in the normalized Prompt 05 DTOs, so
catalog imports assign stable Athens-area demo coordinates and expose
`coordinate_source=demo_synthetic`.

Still not implemented:

- `reservation-service` reservation truth and reservation events,
- analytics, billing, RabbitMQ business consumers/publishers, or frontend
  product screens.

Prompt 07 implements the `status-service` baseline described below.

## Prompt 07 Scope

Implemented:

- `status-service` local table creation for `status_cache` and
  `status_check_logs`.
- Authenticated status lookup through gateway paths:
  `GET /api/status/points/{provider_code}/{external_point_id}/status` and
  `GET /api/status/points/{provider_code}/{external_point_id}`.
- Configurable status cache TTL with default `STATUS_CACHE_TTL_SECONDS=300`.
- Provider-service status lookup through internal provider-service URLs only:
  `GET /internal/points/{external_point_id}/status`.
- Valid cache hits that avoid provider-service calls.
- Cache miss, expired cache, and `forceRefresh=true` provider refresh paths.
- Provider timeout/error fallback to last known cached status with a
  non-sensitive warning.
- Normalized 502 response and failed status-check log when provider lookup
  fails without prior cache.
- Role-gated `GET /api/status/logs` where operators see all logs and provider
  admins see only their provider.
- Public non-sensitive `GET /api/status/freshness` metadata.
- Deterministic fake-provider tests for cache and fallback behavior.

Still not implemented:

- analytics, billing, RabbitMQ business consumers/publishers, or frontend
  product screens.

Prompt 08 implements the `reservation-service` baseline described below.

## Prompt 08 Scope

Implemented:

- `reservation-service` local table creation for `reservations`,
  `reservation_attempts`, and `reservation_event_outbox`.
- Authenticated reservation creation through
  `POST /api/reservations/points/{provider_code}/{external_point_id}/reservations`.
- Catalog point resolution through internal `catalog-service` HTTP before any
  provider reservation call.
- Synchronous provider-service reservation calls through Docker-internal
  service URLs only.
- Successful reservation persistence, successful attempt persistence, and
  pending `reservation.succeeded` outbox records.
- Failed or unknown reservation persistence for provider errors/timeouts,
  failed/unknown attempt persistence, and pending `reservation.failed` outbox
  records.
- EV-user, provider-admin, and operator JWT authorization/scoping for
  reservation, attempt, and outbox inspection endpoints.
- Deterministic fake-client tests for reservation success, catalog rejection,
  provider failure/timeout, persistence, outbox staging, and role scoping.

Still not implemented:

- analytics, billing, frontend product screens, cancellation, refunds, invoice
  generation, or real payment flows.

Prompt 09 implements the RabbitMQ event infrastructure baseline described
below.

## Prompt 09 Scope

Implemented:

- `packages/events` shared Python package with:
  - Pydantic `EventEnvelope`;
  - canonical event type and routing-key constants;
  - RabbitMQ topic exchange topology for `saasplug.events`;
  - primary queues and DLQs for analytics, billing reservations, and catalog
    provider snapshots;
  - blocking publisher helper;
  - consumer acknowledgement primitive;
  - in-memory idempotency helper for tests/local primitives.
- Reservation outbox publisher in `reservation-service`.
- Operator-only endpoint:
  `POST /api/reservations/events/outbox/publish-pending`.
- Outbox publish metadata:
  `publish_attempts`, `last_publish_error`, and
  `last_publish_attempt_at`.
- Deterministic tests for event contracts, topology, publisher/consumer
  helpers, idempotency, outbox envelope construction, successful publish,
  failed publish retry metadata, and duplicate prevention.

Topology summary:

```text
Exchange: saasplug.events
DLX:      saasplug.events.dlx

analytics.events <- usage.*, status.point_checked, reservation.*,
                    catalog.points.imported, billing.charge_created,
                    billing.invoice.*
billing.reservations <- reservation.succeeded, reservation.failed,
                        usage.point_viewed
catalog.provider_snapshots <- provider.points.snapshot_ready

DLQs:
analytics.events.dlq
billing.reservations.dlq
catalog.provider_snapshots.dlq
```

Still not implemented by Prompt 09:

- analytics-service event consumption or aggregate logic,
- billing-service event consumption, charge creation, invoices, or payments,
- provider sync choreography beyond shared event contracts/topology,
- frontend product screens.

Prompt 10 implements the `analytics-service` baseline described below.

## Prompt 10 Scope

Implemented:

- `analytics-service` local table creation for `usage_events`,
  provider/hourly/daily metrics, point daily metrics, status distribution
  metrics, operator daily metrics, catalog health snapshots, billing summary
  snapshots, and export jobs.
- Idempotent ingestion of canonical `packages/events` event envelopes keyed by
  unique `event_id`.
- Operator-only deterministic event ingestion:
  `POST /api/analytics/events/ingest`.
- Operator-only limited RabbitMQ drain from `analytics.events`:
  `POST /api/analytics/events/consume?limit=...`.
- Operator-only aggregate rebuild:
  `POST /api/analytics/aggregates/refresh`.
- Provider-scoped analytics endpoints for summaries, daily trends, top points,
  status distribution, freshness, and usage CSV export.
- Operator analytics endpoints for summary, provider comparison, daily trends,
  catalog health, and freshness.
- Provider-admin JWT scoping that prevents access to another provider's
  analytics or export.
- Deterministic tests for ingestion, idempotency, aggregate refresh,
  reservation/status metrics, role/provider scoping, CSV export, and fake
  RabbitMQ drain behavior.

Still not implemented:

- frontend product screens,
- provider API calls from analytics-service,
- live cross-service dashboard joins,
- scheduler/orchestrator/worker containers.

Prompt 11 implements the `billing-service` baseline described below.

## Prompt 11 Scope

Implemented:

- `billing-service` local table creation for pricing rules, billing events,
  charge records, invoices, invoice lines, payments, and billing outbox rows.
- Idempotent default global pricing seed:
  `0.50 EUR` successful reservation fee, `0.01 EUR` point-view fee, enabled
  point-view charging, and `0.00 EUR` failed-reservation fee.
- Operator pricing APIs for global/default and provider-specific rules, plus
  provider-scoped effective pricing reads.
- Operator-only deterministic event ingestion:
  `POST /api/billing/events/ingest`.
- Operator-only limited RabbitMQ drain from `billing.reservations`:
  `POST /api/billing/events/drain?limit=...`.
- Charge creation from `reservation.succeeded` and optionally
  `usage.point_viewed`; `reservation.failed` is recorded and skipped by
  default.
- Charge idempotency by `source_event_id`.
- Operator-only invoice issuance from unbilled charges.
- Provider-admin invoice viewing and full-invoice mock payment scoped to the
  provider in the JWT.
- Operator/provider billing overview endpoints.
- Billing outbox staging for `billing.charge_created`,
  `billing.invoice_issued`, and `billing.invoice_paid`, with operator-only
  pending publish endpoint.
- Deterministic tests for pricing, ingestion, idempotency, invoices, payment,
  role/provider scoping, fake outbox publishing, and fake RabbitMQ drain.

Still not implemented:

- frontend product screens,
- real payment gateway, refunds, partial payments, subscriptions, and
  tax/accounting compliance,
- scheduler/orchestrator/worker containers.

The next implementation prompt is Prompt 12 for EV frontend flows.

## Canonical References

- Repository instructions: `AGENTS.md`
- Accepted specifications: `docs/specs/SPECIFICATIONS.md`
- Final diagrams: `docs/diagrams/final/`
- AI prompt log: `docs/ai/prompt-log.md`

Follow `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` before changing source,
runtime, documentation, or diagrams.
