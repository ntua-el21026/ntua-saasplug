# saasPlug Architecture Summary

This document summarizes the implemented saasPlug MVP for final review. The
canonical source of truth remains `docs/specs/SPECIFICATIONS.md`.

## Actors and Roles

| Actor | Role | Main capabilities |
|---|---|---|
| EV User | `EV_USER` | Register/login, search charging points, view point details, check status, reserve a point, view own reservations |
| Provider Admin | `PROVIDER_ADMIN` | View own provider points, analytics, invoices, mock-pay issued invoices, export usage logs, view safe provider settings |
| Operator | `OPERATOR` | Manage providers, trigger catalog/import and event operations, view global analytics, edit pricing, issue invoices, inspect system status |
| Scheduler | internal control plane | Dispatch background jobs to service-owned internal endpoints and record run history |
| External Provider APIs | external systems | Provide provider-specific point, status, and reservation APIs for `redPlug`, `greenPlug`, and `bluePlug` |

Provider admins are always scoped to the `provider_code` embedded in their JWT
claims. Operators are not provider-scoped.

## System Context

saasPlug is a Dockerized microservices SaaS application. Browser users interact
with one role-based React + TypeScript + Vite frontend. The frontend calls only
gateway-relative `/api/...` URLs exposed by `nginx-gateway`; it never calls
internal service ports, Docker service hostnames, external provider APIs, or
RabbitMQ directly.

The backend is implemented as Python FastAPI services. Stateful services own
one PostgreSQL container each. RabbitMQ is used only for asynchronous internal
event propagation after source-of-truth state changes have been stored.

## Service Boundaries

| Component | Repository path | Responsibility |
|---|---|---|
| `frontend` | `apps/frontend` | Role-based UI for public/auth, EV, provider-admin, and operator flows |
| `nginx-gateway` | `deploy/nginx/default.conf` | Single public entrypoint and reverse proxy to backend services |
| `auth-service` | `services/auth-service` | Users, password hashes, refresh tokens, JWTs, Google OAuth hooks, role/provider claims |
| `provider-registry-service` | `services/provider-registry-service` | Provider metadata, activation state, safe API config metadata, audit logs |
| `red-provider-service` | `services/red-provider-service` | `redPlug` adapter, raw payloads, local snapshots, sync runs, status/reservation adapter calls |
| `green-provider-service` | `services/green-provider-service` | `greenPlug` adapter, raw payloads, local snapshots, sync runs, status/reservation adapter calls |
| `blue-provider-service` | `services/blue-provider-service` | `bluePlug` adapter, raw payloads, local snapshots, sync runs, status/reservation adapter calls |
| `catalog-service` | `services/catalog-service` | Aggregated normalized catalog, bounds/search queries, point details, import runs, freshness |
| `status-service` | `services/status-service` | Five-minute status cache, status check logs, provider-service status lookup, fallback behavior |
| `reservation-service` | `services/reservation-service` | Reservation truth, synchronous provider reservation calls, attempts, reservation outbox |
| `analytics-service` | `services/analytics-service` | Raw usage events, idempotency, aggregate/cache tables, provider/operator analytics, CSV export |
| `billing-service` | `services/billing-service` | Pricing rules, charges, invoices, invoice lines, mock payments, billing outbox |
| `scheduler-service` | `services/scheduler-service` | Background-job control plane, scheduler metadata, run history, internal HTTP job dispatch |
| `packages/events` | `packages/events` | Shared event envelope, routing keys, RabbitMQ topology, publisher/consumer primitives |

There is no dedicated orchestrator service. Synchronous flows are locally
orchestrated by the responsible service. Background propagation uses event
choreography through RabbitMQ, while `scheduler-service` coordinates timed and
manual background job dispatch without owning business logic.

## Database Ownership

| Service | Owned database container | Main owned tables |
|---|---|---|
| `auth-service` | `auth-postgres` | `users`, `refresh_tokens`, `oauth_states` |
| `provider-registry-service` | `provider-registry-postgres` | `providers`, `provider_config_audit_logs` |
| `red-provider-service` | `red-provider-postgres` | `provider_point_snapshots`, `raw_provider_payloads`, `provider_sync_runs`, `provider_point_changes` |
| `green-provider-service` | `green-provider-postgres` | `provider_point_snapshots`, `raw_provider_payloads`, `provider_sync_runs`, `provider_point_changes` |
| `blue-provider-service` | `blue-provider-postgres` | `provider_point_snapshots`, `raw_provider_payloads`, `provider_sync_runs`, `provider_point_changes` |
| `catalog-service` | `catalog-postgres` | `catalog_points`, `catalog_import_runs`, `catalog_point_changes`, `catalog_import_locks` |
| `status-service` | `status-postgres` | `status_cache`, `status_check_logs` |
| `reservation-service` | `reservation-postgres` | `reservations`, `reservation_attempts`, `reservation_idempotency_records`, `reservation_point_locks`, `reservation_event_outbox` |
| `analytics-service` | `analytics-postgres` | `usage_events`, aggregate/cache tables, snapshots, `export_jobs` |
| `billing-service` | `billing-postgres` | `pricing_rules`, `billing_events`, `charge_records`, `invoices`, `invoice_lines`, `payments`, `billing_event_outbox` |
| `scheduler-service` | `scheduler-postgres` | `scheduled_jobs`, `job_runs` |

Cross-service references use logical IDs such as `provider_code`,
`external_point_id`, `normalized_point_id`, `user_id`, and event IDs. There are
no cross-service SQL joins, shared mutable database tables, or services writing
to another service's database.

## Gateway and API Policy

The local public entrypoint is:

```text
http://localhost:8080/
```

Gateway route groups:

| Gateway path | Service |
|---|---|
| `/api/auth/*` | `auth-service` |
| `/api/provider-registry/*` | `provider-registry-service` |
| `/api/providers/*` | `provider-registry-service` |
| `/api/catalog/*` | `catalog-service` |
| `/api/status/*` | `status-service` |
| `/api/reservations/*` | `reservation-service` |
| `/api/analytics/*` | `analytics-service` |
| `/api/billing/*` | `billing-service` |
| `/api/scheduler/*` | `scheduler-service` |

Provider services are internal-only and are not exposed through the gateway.
Service-owned `/internal/jobs/...` routes are also internal-only and are not
exposed through `nginx-gateway`.
Public FastAPI docs/OpenAPI routes such as `/api/*/docs`, `/api/*/redoc`, and
`/api/*/openapi.json` are blocked by the gateway for the final demo profile.
The gateway sets browser security headers including CSP, frame protection,
`nosniff`, referrer policy, permissions policy, and COOP while allowing the
OpenFreeMap tile host required by the EV map.

## RabbitMQ Event Model

The shared exchange is:

```text
saasplug.events
```

All business events use the common envelope from `packages/events`:

```json
{
  "event_id": "uuid",
  "event_type": "reservation.succeeded",
  "event_version": 1,
  "occurred_at": "2026-06-10T15:20:00Z",
  "correlation_id": "uuid",
  "producer": "reservation-service",
  "payload": {}
}
```

Canonical event types include:

- `provider.sync.requested`
- `provider.points.snapshot_ready`
- `catalog.points.imported`
- `usage.search_performed`
- `usage.point_viewed`
- `status.point_checked`
- `reservation.succeeded`
- `reservation.failed`
- `billing.charge_created`
- `billing.invoice_issued`
- `billing.invoice_paid`

Queues:

| Queue | Purpose |
|---|---|
| `analytics.events` | Analytics ingestion for usage, status, reservation, catalog, and billing events |
| `billing.reservations` | Billing ingestion for reservation and optional point-view charge events |
| `catalog.provider_snapshots` | Catalog/provider snapshot propagation support |

Delivery is at-least-once. Consumers must be idempotent using `event_id`.
RabbitMQ is not used to complete login, map search, point details, status
lookup, reservation provider calls, or live frontend actions. Catalog and
status services publish usage/status/import events only after their own
request/lookup/import work has completed, and those publishes are best-effort
analytics propagation.

## End-to-End Flows

### Login

1. The frontend posts email/password credentials to `/api/auth/auth/login`.
2. `auth-service` verifies the password hash and returns a JWT access token,
   refresh token, role list, and optional provider scope.
3. The frontend stores the session locally and redirects by role.

### EV Search and Reservation

1. EV users search points through `/api/catalog/points` with viewport bounds.
2. Point details come from `/api/catalog/points/{provider_code}/{external_point_id}`.
3. Status lookup goes through `/api/status/points/{provider_code}/{external_point_id}/status`.
4. Reservation creation posts to `/api/reservations/points/{provider_code}/{external_point_id}/reservations`.
5. `reservation-service` resolves the catalog point, records idempotency/attempt
   journal metadata, acquires a short-lived point guard, calls the relevant
   provider service synchronously, stores the reservation result, and stages
   reservation events for confirmed successful or failed outcomes. Ambiguous
   provider outcomes are represented as `unknown`, are not billed as successes,
   and require status/history reconciliation before the frontend sends a new
   provider mutation.

### Provider Sync and Catalog Import

1. The operator triggers a catalog import through `/api/catalog/imports/all` or
   `/api/catalog/imports/providers/{provider_code}`.
2. `catalog-service` calls the relevant provider service over Docker-internal
   URLs.
3. The provider service fetches the external provider API, stores raw payloads
   and local normalized snapshots, and returns normalized points.
4. `catalog-service` upserts the aggregated catalog and records import runs.
5. After successful imports, `catalog-service` publishes
   `catalog.points.imported` for analytics/catalog-health projections.

### Analytics and Billing Propagation

1. Reservation and billing services publish or drain staged events using the
   shared event envelope.
2. `catalog-service` publishes `usage.search_performed`,
   `usage.point_viewed`, and `catalog.points.imported`; `status-service`
   publishes `status.point_checked`.
3. `analytics-service` drains `analytics.events`, stores idempotent
   `usage_events`, and refreshes aggregate/cache tables.
4. `billing-service` drains `billing.reservations`, creates idempotent charges,
   issues invoices on operator request, and records mock payments.

### Scheduler Control Plane

1. `scheduler-service` stores job definitions and run history in
   `scheduler-postgres`.
2. The scheduler evaluates due interval/cron jobs and supports operator manual
   runs, ordered maintenance runs, pause/resume, and interval edits through
   `/api/scheduler/*`.
3. Job execution calls service-owned internal HTTP endpoints on
   `catalog-service`, `analytics-service`, `billing-service`, and
   `reservation-service` with `X-Scheduler-Token`. Each job's
   `timeout_seconds` is applied to the HTTP request deadline.
4. Target services execute their own logic and keep ownership of their own
   databases. The scheduler stores only metadata, run status, HTTP status, and
   redacted response summaries.
5. Stale `running` rows from process crashes are recovered after their timeout
   window so future scheduled/manual executions are not permanently blocked.

Default scheduled cadences are daily catalog import, analytics event drain
every 2 hours, analytics aggregate refresh every day, billing queue drain
every 12 hours, billing outbox publish every 12 hours, reservation outbox
publish every 60 seconds, and daily invoice preparation at 02:30 Europe/Athens.

### Invoice and Mock Payment

1. Operators issue invoices through `/api/billing/invoices/issue`.
2. Provider admins view their own invoices through `/api/billing/invoices`.
3. Provider admins pay issued invoices through `/api/billing/invoices/{invoice_id}/pay`.
4. Payment is mock, full-invoice only, and does not call a real payment gateway.

## Frontend Structure

The frontend lives in `apps/frontend`.

Important route groups:

| Route group | Role |
|---|---|
| `/login`, `/register`, `/logout`, `/profile` | public/authenticated |
| `/map`, `/dashboard`, `/points/...`, `/reservations` | `EV_USER` |
| `/provider/dashboard`, `/provider/points`, `/provider/analytics`, `/provider/invoices`, `/provider/export`, `/provider/settings` | `PROVIDER_ADMIN` |
| `/operator/dashboard`, `/operator/providers`, `/operator/analytics`, `/operator/catalog`, `/operator/invoices`, `/operator/pricing`, `/operator/sync`, `/operator/system` | `OPERATOR` |

The frontend contains feature modules for auth, EV catalog/reservation flows,
provider/operator admin pages, shared components, typed DTOs, and gateway-only
API helpers.

## Known MVP Limitations

- Google OAuth includes configured state validation and PKCE support. In local
  placeholder mode, the explicit local Google sign-in simulation remains a
  coursework/demo convenience for EV users only.
- Frontend tokens are stored in browser localStorage as an MVP trade-off.
  Gateway security headers reduce some browser risk, but production hardening
  should move refresh-token handling to an HttpOnly-cookie/session design.
- Provider API credentials are placeholders by default. Live provider calls may
  fail with authorization errors until real team credentials are configured in
  an uncommitted `.env`.
- Catalog coordinates are deterministic Athens-area demo coordinates because
  the provider DTOs do not expose real latitude/longitude.
- Background jobs are coordinated by `scheduler-service`; live user actions
  remain synchronous and are not queued through RabbitMQ.
- Startup table creation is used for local MVP development instead of full
  Alembic migration management. Existing development volumes that predate new
  tables or constraints may require explicit recreation or a service-local
  migration before relying on the fresh-schema guarantees.
- Billing uses mock payments only. There is no real payment gateway, tax
  accounting, refunds, partial payments, or subscriptions.
- `.env.example` intentionally contains local placeholders. Production-like
  runs should enable strict placeholder rejection with `SAASPLUG_STRICT_SECRETS`
  or a production-like `APP_ENV`.
- Docker runtime and authenticated gateway smoke checks require Docker Desktop
  Linux engine availability on the host.

## Final Documentation

- Final diagrams: `docs/diagrams/final/`
- Final verification: `docs/final-verification.md`
- Submission checklist: `docs/submission-checklist.md`
- AI run log: `docs/ai/prompt-log.md`
