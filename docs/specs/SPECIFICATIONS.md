# saasPlug Final Specifications

**Course:** NTUA ECE - Technologies of Software Services  
**Project:** saasPlug  
**Document type:** Final grouped engineering specifications  
**Status:** Accepted project baseline  
**Language:** English, because all repository artifacts and Codex prompts must be maintained in English.  
**Discussion language:** Greek.  

---

## 0. Document Purpose

This document is the canonical specification baseline for the saasPlug implementation phase. It consolidates the accepted architectural, functional, data, runtime, documentation, and delivery decisions made after reviewing:

1. the assignment statement,
2. the professor-provided SRS,
3. the provider API documentation and OpenAPI YAML files,
4. the course lectures,
5. the project notes from lectures,
6. the existing first-phase UML/repository artifacts,
7. the final engineering decisions made during planning.

The purpose of this file is to prevent architecture drift during implementation. Codex, future contributors, and manual edits must follow this document unless the user explicitly accepts a new SPEC amendment.

---

## 1. Global Project Summary

saasPlug is a SaaS application for electric vehicle charging-point discovery and reservation. It allows EV users to search charging points from multiple charging infrastructure providers, view point information, check availability/status, and reserve a charger. Providers use saasPlug as a B2B service: they register their API configuration, expose charging-point data to the platform, view usage analytics, receive invoices, pay issued invoices through a mock payment flow, and export their own usage logs.

The platform integrates three hypothetical charging providers:

- `redPlug`
- `greenPlug`
- `bluePlug`

Each provider has its own external REST API and schema. saasPlug must use provider-specific integration services and normalize all provider-specific payloads into internal models.

The project must be implemented as a microservices-based, Dockerized SaaS application, with a web frontend, backend services, separate PostgreSQL containers per stateful service, RabbitMQ for asynchronous internal propagation, and an Nginx gateway/reverse proxy.

---

## 2. Non-Negotiable Global Rules

### 2.1 Repository language

All repository artifacts must be written in English:

- source code,
- comments,
- README files,
- documentation,
- SPEC documents,
- Codex prompts,
- AI logs,
- UML diagram labels where practical,
- commit/issue descriptions where practical.

Greek may appear only in professor-provided raw materials or where exact SRS terminology must be preserved.

### 2.2 Provider API handling

The provider OpenAPI YAML files are authoritative for provider adapter implementation:

- `redPlug.yaml`
- `greenPlug.yaml`
- `bluePlug.yaml`

Provider services must not guess field names or endpoint behavior. They must map the actual provider schemas to normalized internal DTOs.

### 2.3 Gateway-only frontend access

The frontend must call only gateway paths.

Allowed frontend call pattern:

```text
frontend -> nginx-gateway -> backend service
```

Forbidden frontend call patterns:

```text
frontend -> red-provider-service:port
frontend -> green-provider-service:port
frontend -> blue-provider-service:port
frontend -> external provider API URL
frontend -> Docker-internal service hostname
```

### 2.4 Database ownership

Each stateful microservice owns its own PostgreSQL container and database. No service may write to another service's database. No cross-service SQL joins are allowed.

### 2.5 RabbitMQ boundaries

RabbitMQ is used for background propagation, provider/catalog synchronization, analytics aggregation, and billing propagation. It is not used for live frontend actions, login, map search, point details, status lookup, or reservation provider calls.

### 2.6 No dedicated orchestrator service

There is no central orchestrator service. Each responsible service locally orchestrates its own synchronous flow. RabbitMQ event choreography is used only for asynchronous propagation.

### 2.7 AI logs subsystem

The official AI logs subsystem is considered unavailable. AI usage must be documented manually in repository-based prompt/run logs.

---

# SPEC-0 - Sources of Truth and Decision Process

## SPEC-0.1 Status

Accepted.

## SPEC-0.2 Decision

The final architecture and implementation must be based on the following source priority:

1. Assignment statement and professor-provided SRS.
2. Project Notes from Lectures.
3. Provider OpenAPI specs for `redPlug`, `greenPlug`, and `bluePlug`.
4. Course lectures.
5. Existing repository diagrams and phase-1 artifacts.
6. Accepted SPEC decisions in this document.

Existing diagrams, ADRs, and prior repository artifacts are inputs, not binding final decisions. They must be updated or replaced where they conflict with the accepted SPECs.

## SPEC-0.3 Decision register rule

Every major architectural or implementation decision must be traceable to a SPEC section or to a later explicit amendment.

Accepted SPECs are binding. Proposed, rejected, or historical notes are not binding.

## SPEC-0.4 Implementation rule

Codex must not invent a different architecture, rename services, add new services, change data ownership, or introduce new infrastructure unless explicitly instructed and accepted by the user.

---

# SPEC-1 - MVP Scope by Actor

## SPEC-1.1 Status

Accepted.

## SPEC-1.2 MVP principle

The MVP must cover all major assignment-required actors and flows, but each feature must be implemented in the simplest acceptable form that still demonstrates correct SaaS, microservices, Docker, API integration, analytics, billing, and documentation design.

The MVP must be more than static dummy screens. It must provide an end-to-end operational flow:

```text
login -> search/map -> point details -> status -> reservation -> events -> analytics -> billing -> invoice -> mock payment
```

## SPEC-1.3 EV User scope

The EV User must be able to:

| Feature | Final behavior |
|---|---|
| Google login | Supported through `auth-service`. |
| Email/password login | Supported through `auth-service` using JWT or equivalent token-based authentication. |
| View charging points | Supported through local aggregated catalog data. |
| Search/filter charging points | Supported through `catalog-service`, including viewport/bounds-based map loading. |
| View point details | Supported from cached/local aggregated catalog. |
| Refresh/check point status | Supported through `status-service` with 5-minute cache. |
| Reserve charging point | Supported through synchronous `reservation-service` call to the appropriate provider service. |
| View own reservations | Supported in EV user UI. |
| View own reservation summary | Supported through `analytics-service` projections scoped to the authenticated EV user. |
| Cancel reservation | Out of scope unless provider APIs clearly support it and implementation remains simple. |
| Pay for charging | Out of scope. saasPlug does not charge EV users. |

The EV User never calls provider APIs directly. EV cost displays are estimates
only: `price_per_kwh_eur` is presented as `Cost/kWh`, and estimated cost is
computed from `Cost/kWh * charger kW * requested duration` only when all inputs
are available.

## SPEC-1.4 Provider Admin scope

Provider Admins must be able to:

| Feature | Final behavior |
|---|---|
| Register provider | Simple but real provider registration/onboarding. |
| Store provider API info | Stored by `provider-registry-service`. |
| View own charging points | Filtered to their provider. |
| View own analytics | Realistic provider analytics, not trivial counters only. |
| View invoices | View issued invoices for their own provider. |
| Pay invoice | Pay full issued invoice through mock payment. |
| Export own logs | Export CSV usage logs. |
| Edit provider API configuration | Simple edit if not overly complex. |
| Manage provider users/team | Out of scope. |
| Issue official invoices | Forbidden. Only the operator can issue invoices. |

Provider Admins are always scoped to their own provider.

## SPEC-1.5 Provider analytics scope

Provider analytics must be realistic and useful, but not overly complex. Provider dashboards must include at least:

- total searches involving the provider,
- total point views/clicks, including map/list quick views and full detail views,
- status cache hit rate and live provider status refresh count,
- successful reservations,
- failed reservations,
- reservation conversion rate,
- top viewed charging points,
- top reserved charging points,
- point views by status,
- fees/charges owed to saasPlug,
- invoice/payment status,
- data freshness indicators,
- CSV export by date range.

## SPEC-1.6 saasPlug Operator scope

The operator must be able to:

| Feature | Final behavior |
|---|---|
| Login as operator | Supported through seeded or configured account. |
| View all providers | Supported. |
| View global analytics | Supported. |
| Filter analytics by provider/date | Supported. |
| View invoice/payment overview | Supported. |
| Trigger provider sync manually | Supported for demo/debug. |
| Run/pause/resume scheduler jobs | Supported through the operator Sync page and `/api/scheduler/*`. |
| Change scheduler intervals | Supported for interval jobs through the operator Sync page and scheduler API. |
| Configure pricing rules dynamically | Supported simply: global defaults and provider-specific overrides. |
| Manage users/providers deeply | Out of scope. |
| Issue invoices | Supported. Operator-only. |

## SPEC-1.7 External Provider API scope

saasPlug integrates:

| Provider | Required integration scope |
|---|---|
| `redPlug` | list points, details/status as needed, reserve |
| `greenPlug` | list points, details/status as needed, reserve |
| `bluePlug` | list points, details/status as needed, reserve |

Each provider service must normalize provider-specific fields to internal DTOs.

## SPEC-1.8 Scheduler/background scope

The system must support background or scheduled operations for:

- provider catalog sync,
- provider-local snapshot updates,
- aggregated catalog updates,
- analytics aggregation,
- billing aggregation/invoice preparation,
- manual sync/refresh where useful for demo.

Phase C implements this through `scheduler-service` as a control plane with
`scheduler-postgres` for job definitions and run history. The scheduler calls
service-owned internal HTTP job endpoints protected by `X-Scheduler-Token`; it
does not contain catalog, analytics, billing, or reservation business logic and
does not access other service databases.

Default automatic job cadence:

| Job | Default cadence | Purpose |
|---|---|---|
| `catalog.import.all` | Daily | Refresh the local aggregated catalog from provider-service snapshots. |
| `analytics.consume-events` | Every 2 hours | Drain RabbitMQ events into analytics-owned raw event tables. |
| `analytics.refresh-aggregates` | Daily | Rebuild dashboard aggregate/cache tables from already-ingested analytics events. |
| `billing.drain-events` | Every 12 hours | Drain reservation/point-view events from RabbitMQ into billing-owned event and charge tables. |
| `billing.publish-outbox` | Every 12 hours | Publish billing outbox events after billing has created charges, issued invoices, or recorded payments. |
| `reservation.publish-outbox` | Every 60 seconds | Publish reservation result events after synchronous reservation completion. |
| `billing.prepare-invoices` | Daily at 02:30 Europe/Athens | Prepare invoice candidate summaries without issuing invoices. |

Operators may manually run these jobs and may adjust interval-job cadences from
the UI without bypassing service ownership. The scheduler persists operator
schedule edits in `scheduler-postgres`.

For controlled live testing, the operator Sync page may apply the validated
30-second minimum to every interval job or restore the `DEFAULT_JOBS` interval
cadence. These bulk presets do not change cron/manual jobs or enabled state.

Manual refresh controls are operator-only. EV-user and provider-admin pages do
not expose status, analytics, reservation-statistics, or billing refresh
buttons. Operator Analytics provides `Refresh stats`, which consumes one
bounded `analytics.events` batch through analytics-service and then rebuilds
all analytics aggregates. The operation does not republish events; normal
analytics ingestion deduplication handles duplicate deliveries.

Analytics `Tracked revenue` is estimated provider charging revenue from
successful EV reservations. It uses `estimated_cost_eur` when supplied by the
reservation event, otherwise
`price_per_kwh_eur × charger_capacity_kw × duration_minutes / 60`. Failed
reservations and SaaS billing events are excluded. Billing-service remains a
separate concern and calculates fees owed by providers to the operator.

Operators may also run the ordered maintenance sequence from the Sync page. The
sequence runs existing service-owned jobs in this order: `catalog.import.all`,
`reservation.publish-outbox`, `billing.drain-events`,
`billing.publish-outbox`, `analytics.consume-events`, and
`analytics.refresh-aggregates`. This order first refreshes catalog data and
publishes reservation/billing events, then drains analytics and refreshes
dashboard aggregates.

## SPEC-1.9 Explicitly out of scope

The following are out of scope:

- real payment gateway,
- load balancing,
- Kubernetes,
- advanced GIS/map clustering,
- mobile app,
- full enterprise provider dashboard,
- official AI logs subsystem,
- complex sprint methodology,
- real tax/accounting compliance,
- complex pricing tiers,
- refunds,
- partial payments.

## SPEC-1.10 MVP Definition of Done

The MVP is functionally complete when the following demo is possible:

1. The whole system starts with Docker Compose.
2. Provider sync fetches points from `redPlug`, `greenPlug`, and `bluePlug`.
3. An EV user logs in with Google or email/password.
4. The EV user views and searches charging points.
5. The map loads points by viewport/bounds, not all at once.
6. The EV user opens point details from the cached catalog.
7. The EV user checks status through `status-service` and 5-minute cache.
8. The EV user makes a reservation.
9. The reservation is stored.
10. Reservation events propagate to analytics and billing.
11. Provider Admin sees provider analytics and usage logs.
12. Provider Admin exports CSV logs.
13. Operator sees global analytics.
14. Operator edits simple pricing rules.
15. Operator issues invoices.
16. Provider Admin views and pays issued invoices with mock payment.
17. No frontend request exposes internal service ports or provider API URLs.

---

# SPEC-2 - Provider API and Data Acquisition Strategy

## SPEC-2.1 Status

Accepted.

## SPEC-2.2 High-level strategy

Use a hybrid provider data acquisition strategy.

| Function | Strategy |
|---|---|
| Charging point catalog/list | Local provider snapshots and aggregated catalog. |
| Search/filter/map | Local aggregated catalog through `catalog-service`. |
| Point details | Cached/local aggregated catalog. |
| Displayed current status | Backend-mediated lookup through `status-service` and provider service, with operator-configurable cache TTL. |
| Reservation | Synchronous backend-mediated provider call through `reservation-service` and provider service. |
| Analytics | Events and analytics read models, not provider live calls. |
| Billing | Events and billing records, not provider live calls. |

## SPEC-2.3 Provider-specific services

There is one provider integration service per provider:

- `red-provider-service`
- `green-provider-service`
- `blue-provider-service`

Each service is responsible for:

- calling the provider's list/detail/status/reservation endpoints,
- storing provider-local snapshots,
- storing raw payloads for traceability,
- normalizing provider payloads,
- mapping provider status values to internal status values,
- normalizing reservation responses,
- converting provider errors into normalized internal errors.

If a new provider is added later, a new provider-specific service should be added instead of overloading existing services.

## SPEC-2.4 Aggregated catalog service

`catalog-service` owns the aggregated normalized charging-point catalog.

It is responsible for:

- storing normalized points from all providers,
- serving map/search/filter endpoints,
- supporting viewport/bounds-based loading,
- tracking `last_catalog_sync_at`, `last_seen_at`, and stale/inactive points,
- applying full upsert with change detection,
- providing cached point details to the frontend,
- emitting catalog/import events for analytics.

## SPEC-2.5 Internal point identity

Internal point identity must avoid provider ID collisions.

The normalized key format is:

```text
provider_code:external_point_id
```

Examples:

```text
redPlug:12345
greenPlug:12345
bluePlug:12345
```

The catalog may additionally assign internal UUIDs.

## SPEC-2.6 Catalog sync policy

Catalog sync is periodic and manually triggerable.

| Trigger | Final behavior |
|---|---|
| Automatic sync | Supported. |
| Default frequency | Daily. |
| Manual sync | Supported from operator UI. |
| First-start sync | Supported when catalog is empty. |
| Retry policy | Few retries with backoff. |
| Live sync per user search | Forbidden. |

## SPEC-2.7 Provider-local snapshot policy

Each provider service fetches all provider points during sync, stores the provider-local snapshot in its own PostgreSQL container, and exposes/publishes normalized results for catalog import.

Provider services must store:

- provider-local point snapshots,
- provider raw payloads,
- sync runs,
- provider-local changes where useful.

## SPEC-2.8 Catalog upsert policy

`catalog-service` imports provider snapshots using full upsert with change detection:

- existing points are updated,
- new points are inserted,
- missing points are not immediately deleted; they are marked stale/inactive,
- timestamps are updated,
- raw provider payload references or snapshots may be retained for debugging.

## SPEC-2.9 Status strategy

Status lookup is real-time from the user's perspective, but cached by
`status-service` for 5 minutes by default. The active TTL is an operator-owned
persistent policy with a 30-second minimum; the operator Sync control-plane
presets update this policy alongside interval jobs. A policy change
recalculates expiry for existing cache rows immediately.

Flow:

```text
frontend -> nginx-gateway -> status-service -> status-postgres cache -> provider service if expired -> external provider API
```

Normalized internal status enum:

```text
available
charging
reserved
malfunction
offline
unknown
```

Provider-specific unknown or missing status maps to `unknown`.

Every frontend current-status display must use `status-service`, including map
quick views, list cards, point details, and provider/operator point tables.
`catalog-service` status is an import snapshot for catalog persistence and
background context, not the current-status source of truth for UI rendering.
When a cache row is expired, `status-service` refreshes it through the relevant
provider service. Reservations do not trust the cache; `reservation-service`
calls the provider service synchronously and lets the provider accept or reject
the reservation against current provider state.

## SPEC-2.10 Reservation strategy

Reservations are synchronous and not queued before provider call.

Flow:

```text
frontend -> nginx-gateway -> reservation-service -> provider service -> external provider API
```

Before the external provider mutation, `reservation-service` may store a durable
idempotency/attempt journal and acquire a same-point in-flight guard. This is
not a queue and does not defer the provider call. After the provider call
returns, `reservation-service` stores the reservation result and stages outbox
events for analytics and billing.

Ambiguous provider outcomes, including provider timeouts and invalid provider
success payloads, must be represented as `unknown` rather than retried as a
fresh mutation immediately. The API response should include machine-readable
unknown/reconciliation metadata, and the frontend must require reservation
history review before sending a new provider mutation. Confirmed successful
reservations require a future expiry. Timezone-aware provider timestamps are
preserved in UTC, and timezone-naive future timestamps are normalized as UTC.
Missing, malformed, or past expiry values must not create indefinitely active
local reservations or successful billing events.

## SPEC-2.11 Missing values and timeout policy

| Case | Behavior |
|---|---|
| Missing price | Display `Price unavailable`. |
| Last known price exists | Display last known price with timestamp where useful. |
| Missing status | Display `unknown`. |
| Status provider timeout | Return last known status if available with warning/freshness indicator. |
| Reservation provider timeout | Store unknown attempt/result, return clear message, and require reconciliation before fresh retry. |
| Provider 400/404/500 | Normalize to internal error response; provider already-reserved/unavailable responses return a conflict-style reservation error. |
| Sync failure | Store failed sync run, retry, preserve previous catalog. |

Raw provider errors must not be shown directly to users.

---

# SPEC-3 - Microservices Boundaries

## SPEC-3.1 Status

Accepted.

## SPEC-3.2 Boundary principle

Services are split by business responsibility, not by technical layers.

Do not create services like:

```text
controller-service
repository-service
database-service
```

Use business services such as:

```text
auth-service
catalog-service
reservation-service
analytics-service
billing-service
```

## SPEC-3.3 Runtime components

The runtime system contains:

| Component | Type | Purpose |
|---|---|---|
| `frontend` | Web app | Role-based UI for EV users, provider admins, and operator. |
| `nginx-gateway` | Gateway/reverse proxy | Single public entrypoint and internal route mapping. |
| `auth-service` | Backend service | Authentication, Google OAuth, email/password, JWT, roles. |
| `provider-registry-service` | Backend service | Provider metadata and API configuration. |
| `red-provider-service` | Backend service | Adapter and local snapshot storage for redPlug. |
| `green-provider-service` | Backend service | Adapter and local snapshot storage for greenPlug. |
| `blue-provider-service` | Backend service | Adapter and local snapshot storage for bluePlug. |
| `catalog-service` | Backend service | Aggregated normalized charging-point catalog. |
| `status-service` | Backend service | Status cache and provider status lookup. |
| `reservation-service` | Backend service | Reservation execution and reservation records. |
| `analytics-service` | Backend service | Usage events, aggregates, dashboards, exports. |
| `billing-service` | Backend service | Pricing, charges, invoices, mock payments. |
| `rabbitmq` | Infrastructure | Async event propagation. |
| service-specific PostgreSQL containers | Infrastructure | One PostgreSQL container per stateful service. |

## SPEC-3.4 API Gateway responsibilities

`nginx-gateway` is required but is not a business service.

It must:

- expose the single public application entrypoint,
- hide internal service ports,
- route `/api/auth/*` to `auth-service`,
- route `/api/providers/*` to `provider-registry-service`,
- route `/api/catalog/*` to `catalog-service`,
- route `/api/status/*` to `status-service`,
- route `/api/reservations/*` to `reservation-service`,
- route `/api/analytics/*` to `analytics-service`,
- route `/api/billing/*` to `billing-service`,
- avoid business logic.

Provider services should generally not be exposed publicly through the gateway.

## SPEC-3.5 Auth service responsibilities

`auth-service` owns:

- Google OAuth login,
- email/password login,
- password hashing,
- JWT issuing,
- refresh tokens,
- roles,
- seeded demo accounts,
- provider-admin association through logical provider references.

It does not own provider business metadata, reservations, analytics, or billing.

## SPEC-3.6 Provider Registry service responsibilities

`provider-registry-service` owns:

- provider registration,
- provider metadata,
- provider activation status,
- provider API configuration,
- provider config audit/log metadata,
- provider lookup for internal services.

It does not fetch charging points or own catalog data.

## SPEC-3.7 Provider service responsibilities

Each provider service owns:

- external API calls for its provider,
- provider-local point snapshots,
- provider-local raw payloads,
- provider-local sync run records,
- provider-specific normalization,
- status and reservation adapter calls.

Provider services do not own global catalog search, analytics, billing, or user-facing UI.

## SPEC-3.8 Catalog service responsibilities

`catalog-service` owns:

- aggregated normalized catalog,
- viewport/bounds map loading,
- search/filter APIs,
- point details from cached catalog,
- active/stale point flags,
- catalog import/change detection,
- catalog events.

It does not own live status truth or reservations.

## SPEC-3.9 Status service responsibilities

`status-service` owns:

- default-five-minute, operator-configurable status cache,
- status check logs,
- last known status,
- fallback behavior for timeouts,
- status lookup through provider services when cache expires,
- optional status analytics events.

It does not own catalog details or reservations.

## SPEC-3.10 Reservation service responsibilities

`reservation-service` owns:

- reservation API,
- point/provider resolution through catalog,
- synchronous provider reservation call,
- reservation records,
- EV-facing cost/kWh, charger-power, estimated-energy, and estimated-cost
  snapshots for reservation display and analytics events,
- successful/failed reservation attempts,
- reservation events for analytics/billing.

It does not generate invoices or dashboards.

## SPEC-3.11 Analytics service responsibilities

`analytics-service` owns:

- raw usage event ingestion,
- idempotent event storage,
- hourly/daily aggregate tables,
- EV reservation summary projections,
- provider analytics API,
- operator analytics API,
- EV reservation analytics API,
- CSV usage log export,
- data freshness indicators.

It must continue serving already computed analytics even if reservation-service is unavailable.

## SPEC-3.12 Billing service responsibilities

`billing-service` owns:

- pricing rules,
- provider-specific pricing overrides,
- charge records,
- invoice records,
- invoice lines,
- mock payment records,
- invoice issuance by operator,
- payment events.

It does not own usage analytics or reservation truth.

## SPEC-3.13 Services explicitly not created

The following are intentionally not separate services:

| Not created | Reason |
|---|---|
| `pricing-service` | Pricing belongs in `billing-service`. |
| `payment-service` | Mock payment belongs in `billing-service`. |
| `export-service` | CSV export belongs in `analytics-service`. |
| `search-service` | Search belongs in `catalog-service`. |
| `map-service` | Map behavior belongs to frontend + catalog API. |
| `notification-service` | Out of scope. |
| `orchestrator-service` | Rejected; local orchestration plus choreography is used. |
| `ai-log-service` | Official AI logs subsystem is out of scope. |

## SPEC-3.14 Map loading requirement

The map must not load all charging points at once. It must request points by current viewport/bounds as the user pans or zooms.

Example request pattern:

```text
GET /api/catalog/points?minLat=...&maxLat=...&minLng=...&maxLng=...&zoom=...
```

---

# SPEC-4 - Data Ownership and Persistence Strategy

## SPEC-4.1 Status

Accepted.

## SPEC-4.2 Database topology

Each stateful microservice has its own PostgreSQL container.

| Service | PostgreSQL container |
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
| `scheduler-service` | `scheduler-postgres` |

MongoDB is not used for the MVP unless explicitly revisited.

## SPEC-4.3 Cross-service data access rules

Allowed:

- service-to-service REST calls,
- RabbitMQ events,
- logical IDs,
- duplicated projections/read models,
- snapshots for analytics/reporting.

Forbidden:

- cross-service SQL joins,
- writing to another service's database,
- shared mutable tables,
- database-level foreign keys across service databases,
- analytics directly querying reservation or billing databases,
- billing directly querying analytics database as source of truth.

## SPEC-4.4 Auth data ownership

`auth-service` owns:

- users,
- credentials,
- OAuth accounts,
- refresh tokens,
- user roles,
- provider-admin logical scope.

Minimum tables:

```text
users
credentials
oauth_accounts
refresh_tokens
user_roles
```

## SPEC-4.5 Provider Registry data ownership

`provider-registry-service` owns:

- providers,
- provider API configs,
- provider activation status,
- provider config audit.

Minimum tables:

```text
providers
provider_api_configs
provider_config_audit
```

## SPEC-4.6 Provider service data ownership

Each provider service owns provider-local data.

Minimum tables for each provider DB:

```text
provider_points
provider_sync_runs
provider_raw_payloads
provider_point_changes
```

Provider-local snapshots are not the global catalog. They are provider-specific source snapshots used for normalization and catalog import.

## SPEC-4.7 Catalog data ownership

`catalog-service` owns the aggregated normalized catalog.

Minimum tables:

```text
charging_points
catalog_sync_runs
catalog_provider_imports
catalog_point_versions
```

`charging_points` should include at least:

- internal UUID,
- provider ID logical reference,
- provider code,
- external point ID,
- normalized point key,
- name,
- address/location,
- latitude,
- longitude,
- connector type,
- power/capacity,
- price value/currency where available,
- price missing flag,
- last catalog sync timestamp,
- last seen timestamp,
- active/stale flag,
- raw payload snapshot/reference where useful.

The catalog must support indexes for viewport/bounds query:

- latitude,
- longitude,
- provider code,
- active/stale status,
- connector type where useful.

## SPEC-4.8 Status data ownership

`status-service` owns:

```text
point_status_cache
status_check_log
```

Cache TTL defaults to 5 minutes and has a 30-second operator-configurable
minimum. The active policy is stored by `status-service` and applies to both
new cache writes and already cached rows after policy updates.

The cache stores:

- internal point ID,
- provider code,
- external point ID,
- normalized status,
- raw provider status,
- checked timestamp,
- expiration timestamp,
- last error where useful.

## SPEC-4.9 Reservation data ownership

`reservation-service` owns:

```text
reservations
reservation_attempts
```

Reservation records include:

- internal reservation ID,
- user ID logical reference,
- provider ID/code,
- internal point ID,
- external point ID,
- requested minutes,
- status,
- provider reservation ID if provided,
- reservation end time if provided,
- raw provider response,
- normalized error code/message,
- timestamps.

## SPEC-4.10 Analytics data ownership

`analytics-service` owns:

```text
usage_events
provider_hourly_metrics
provider_daily_metrics
point_daily_metrics
provider_status_daily_metrics
operator_daily_metrics
ev_reservation_daily_metrics
catalog_health_snapshots
billing_summary_snapshots
export_jobs
```

The analytics DB is a read/aggregate model fed by events. It is not source of truth for reservations or billing.

## SPEC-4.11 Billing data ownership

`billing-service` owns:

```text
pricing_rules
charge_records
invoices
invoice_lines
payments
```

Billing is the financial source of truth.

## SPEC-4.12 Logical references

Cross-service relationships are represented by logical IDs:

```text
user_id
provider_id
provider_code
internal_point_id
external_point_id
reservation_id
invoice_id
source_event_id
```

These are not cross-database foreign keys.

## SPEC-4.13 Data duplication policy

Controlled duplication is allowed only as projection/snapshot data.

Examples:

- provider code in analytics/billing,
- point name snapshot in point metrics,
- reservation summary in analytics and billing,
- billing summary snapshots in analytics,
- last known status for display/performance.

Duplicated data is never the source of truth unless the owning service says so.

## SPEC-4.14 Migrations and seed data

Each stateful service owns its schema/model definitions and seed data. For the
coursework MVP/local Docker runtime, services initialize schemas with
SQLAlchemy `Base.metadata.create_all` for deterministic setup. Alembic-style
migrations remain deferred as a production hardening item.

Seed data must include where relevant:

- operator user,
- demo EV user,
- demo provider admins,
- red/green/blue provider metadata,
- provider API configuration placeholders,
- default pricing rules.

---

# SPEC-5 - Events, RabbitMQ, and Async Flows

## SPEC-5.1 Status

Accepted.

## SPEC-5.2 Communication model

Use:

| Flow type | Technology |
|---|---|
| Immediate user-facing request/response | REST/internal HTTP |
| Background propagation/synchronization | RabbitMQ events |

## SPEC-5.3 RabbitMQ usage

RabbitMQ is used for:

- provider catalog sync,
- provider snapshot readiness,
- catalog aggregation/import events,
- catalog search and point-view analytics events after the relevant catalog
  read or point-view tracking request has completed,
- status-check analytics events after the status lookup/log write has
  completed,
- analytics aggregation,
- billing charge creation,
- optional invoice/payment notifications.

RabbitMQ is not used for:

- login,
- provider registration,
- completing map search responses,
- completing point-detail responses,
- completing status lookup responses,
- reservation provider call,
- direct frontend actions.

## SPEC-5.4 Exchange model

Use one RabbitMQ topic exchange:

```text
saasplug.events
```

Routing keys use domain-based names, such as:

```text
provider.sync.requested
provider.points.snapshot_ready
catalog.points.imported
usage.search_performed
usage.point_viewed
status.point_checked
reservation.succeeded
reservation.failed
billing.charge_created
billing.invoice_issued
billing.invoice_paid
```

## SPEC-5.5 Event envelope

All events use a common envelope:

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

Required fields:

- `event_id`,
- `event_type`,
- `event_version`,
- `occurred_at`,
- `correlation_id`,
- `producer`,
- `payload`.

## SPEC-5.6 Delivery guarantee

Use at-least-once delivery.

Consumers must be idempotent. Duplicate events must not create duplicate charges, duplicate usage records, or duplicate aggregate counts.

Recommended constraints:

- `analytics.usage_events.event_id UNIQUE`,
- `billing.charge_records.source_event_id UNIQUE`,
- catalog import idempotency keyed by provider/sync run/snapshot.

## SPEC-5.7 Dead-letter queues

Use simple DLQs for failed event handling.

Examples:

```text
analytics.events.dlq
billing.reservations.dlq
catalog.provider_snapshots.dlq
```

The MVP does not require a DLQ UI. Logs are sufficient.

## SPEC-5.8 Provider sync event flow

```text
scheduler/operator -> provider services -> provider-local DBs -> catalog-service -> catalog-postgres -> catalog.points.imported
```

The current MVP catalog import is executed by service-owned HTTP calls through
`catalog-service` and provider services. After a successful import,
`catalog-service` publishes `catalog.points.imported` as a best-effort analytics
event. RabbitMQ provider snapshot events remain part of the shared topology but
are not required to complete the MVP import path.

## SPEC-5.9 Usage analytics events

The following user/system activities publish analytics events:

- search performed,
- point viewed,
- status checked,
- reservation succeeded,
- reservation failed,
- catalog imported,
- invoice issued,
- invoice paid.

`catalog-service` publishes `usage.search_performed`,
`usage.point_viewed`, and `catalog.points.imported` after the relevant catalog
operation has completed. A point view is counted when the EV user opens the
map/list quick-view popup or the full point-detail page. `status-service`
publishes `status.point_checked` after a status lookup/log write has completed.
These publishers are best-effort: a RabbitMQ outage must not make catalog
search, point views, point details, or status lookup fail after the source
service has completed its own request.

## SPEC-5.10 Reservation event flow

Reservation remains synchronous until the provider result is known.

Only after storing the result does `reservation-service` publish:

- `reservation.succeeded`, or
- `reservation.failed`.

## SPEC-5.11 Billing event flow

`billing-service` consumes reservation and optional point-view events, creates charges, and may publish:

- `billing.charge_created`,
- `billing.invoice_issued`,
- `billing.invoice_paid`.

## SPEC-5.12 Dashboard reads

Dashboard reads are synchronous API calls to analytics/billing services, but they read precomputed aggregate/cache tables, not raw live cross-service data.

## SPEC-5.13 Point details reads

Point details are synchronous reads from the cached/local aggregated catalog for
static point metadata. Displayed current status goes through `status-service`
and its active cache policy.

## SPEC-5.14 Orchestrator decision

A dedicated orchestrator service is rejected.

Use:

- local orchestration inside responsible services,
- event choreography for background propagation,
- scheduler-service as a background-job control plane only,
- no distributed transactions,
- no saga implementation for MVP.

`scheduler-service` is not a business orchestrator. It stores scheduler
metadata, evaluates due jobs, and calls internal job endpoints on the
responsible service. Live user actions remain synchronous and are not moved to
RabbitMQ.

---

# SPEC-6 - Analytics Design

## SPEC-6.1 Status

Accepted.

## SPEC-6.2 Analytics architecture

`analytics-service` consumes RabbitMQ events, stores raw events idempotently,
computes aggregate tables, and serves provider, operator, and EV reservation
dashboard data.

Data flow:

```text
RabbitMQ events -> analytics.usage_events -> aggregation jobs -> aggregate tables -> dashboards
```

## SPEC-6.3 Event sources

Analytics consumes events from:

- `catalog-service`,
- `status-service`,
- `reservation-service`,
- `billing-service`.

It does not query their databases directly.

## SPEC-6.4 Raw event model

`usage_events` stores:

- internal ID,
- external event ID,
- event type,
- event version,
- occurred timestamp,
- ingested timestamp,
- correlation ID,
- producer,
- user ID,
- provider ID/code,
- internal point ID,
- external point ID,
- JSONB payload.

`event_id` must be unique.

## SPEC-6.5 Provider dashboard

Provider dashboard includes:

- total point views,
- total searches involving provider,
- status cache hit rate and live provider status refresh count,
- successful reservations,
- failed reservations,
- reservation conversion rate,
- top viewed points,
- top reserved points,
- point views by status,
- fees/charges generated,
- unpaid/paid invoice summaries,
- data freshness,
- CSV export.

Conversion rate:

```text
successful_reservations / point_views
```

If `point_views = 0`, display `N/A`.

## SPEC-6.6 Operator dashboard

Operator dashboard includes:

- total providers,
- active providers,
- active/stale points,
- total searches,
- total point views,
- total successful reservations,
- total failed reservations,
- global conversion rate,
- provider comparison,
- trends by day,
- failed reservation counts,
- provider sync failures,
- billing overview,
- paid/unpaid invoice totals,
- catalog health,
- manual aggregate refresh.

## SPEC-6.7 EV reservation summary

The EV reservation summary is scoped to the authenticated EV user and includes:

- total reservation records from reservation events,
- successful and failed reservation counts,
- successful reserved duration,
- distinct charging points,
- total estimated energy,
- total estimated cost,
- average estimated cost per point,
- missing-estimate count,
- freshness metadata.

Estimated cost is a projection, not an EV payment flow. It is computed only when
the reservation event has valid cost/kWh, charger kW, and requested duration.
Missing values remain unavailable and are excluded from cost totals and
averages.

Reserved-point timing is displayed wherever the owning read model contains it.
UI current-status views show the `status-service` reserved-until timestamp,
while reservation records show the created-to-end reservation window.

## SPEC-6.8 Aggregate tables

Required aggregate/cache tables include:

- `provider_hourly_metrics`,
- `provider_daily_metrics`,
- `point_daily_metrics`,
- `provider_status_daily_metrics`,
- `operator_daily_metrics`,
- `ev_reservation_daily_metrics`,
- `catalog_health_snapshots`,
- `billing_summary_snapshots`.

## SPEC-6.9 Aggregation frequency

| Aggregate | Frequency |
|---|---|
| Raw event ingestion | near real-time from RabbitMQ |
| Provider hourly metrics | hourly |
| Provider daily metrics | daily + manual refresh |
| Operator daily metrics | daily + manual refresh |
| Point daily metrics | daily + manual refresh |
| EV reservation daily metrics | daily + manual refresh |
| Billing summary snapshots | hourly or on billing events |

Manual analytics aggregate refresh must rebuild all aggregate/cache tables,
including EV reservation daily metrics.

## SPEC-6.10 CSV export

`analytics-service` provides CSV export of provider usage logs.

Provider Admin can export only own provider logs. Operator can export all or by provider.

Provider-admin CSV export is minimized to provider-relevant operational fields
and must not include direct user IDs or raw event payload JSON. Provider export
columns should include:

```text
occurred_at,event_type,provider_code,internal_point_id,external_point_id,point_name,status,amount,currency,reservation_reference
```

Operator export may include richer audit columns such as `user_id`,
`reservation_id`, and sanitized raw details because it is operator-scoped.

## SPEC-6.11 Data freshness indicators

Dashboards must show:

- last event ingested time,
- last aggregate computed time,
- last catalog sync time,
- analytics delay notice.

## SPEC-6.12 Out of scope

Out of scope:

- real-time streaming dashboards,
- predictive analytics,
- anomaly detection,
- BI query builder,
- cross-service live joins,
- analytics calling provider APIs.

---

# SPEC-7 - Billing, Pricing, Invoices, and Mock Payment

## SPEC-7.1 Status

Accepted.

## SPEC-7.2 Billing ownership

`billing-service` with `billing-postgres` is the financial source of truth.

It owns:

- pricing rules,
- charge records,
- invoices,
- invoice lines,
- payments.

## SPEC-7.3 Pricing model

Pricing supports:

- global default rules,
- provider-specific overrides,
- successful reservation fee,
- optional point view fee,
- failed reservation fee defaulting to 0,
- currency `EUR`.

Default conceptual values:

```text
reservation_success_fee = 0.50 EUR
point_view_fee = 0.01 EUR
reservation_failure_fee = 0.00 EUR
```

Actual values can be edited by the operator.

## SPEC-7.4 Dynamic pricing rules

Operator can edit:

- global default pricing,
- provider-specific pricing overrides,
- point view fee enable/disable,
- active pricing rule.

At most one global pricing rule and one provider-specific pricing rule per
provider should be active. Provider-specific active rules override the global
fallback. Activating a global rule deactivates provider-specific rules; when
all three providers have active provider-specific rules, the global rule is
deactivated.

Complex tiers, coupons, subscriptions, and contracts are out of scope.

## SPEC-7.5 Charge creation

Charges are created from events:

| Event | Charge behavior |
|---|---|
| `reservation.succeeded` | Create reservation success charge. |
| `usage.point_viewed` | Create point view charge if enabled. |
| `reservation.failed` | No charge by default. |

Charges must be idempotent using `source_event_id UNIQUE`.

Provider-admin charge responses must be provider-scoped and omit direct EV user
IDs, reservation IDs, and raw event payload JSON. Operators may retain richer
internal charge visibility.

## SPEC-7.6 Charge lifecycle

Charge status values:

```text
unbilled
invoiced
paid
void
```

Typical flow:

```text
unbilled -> invoiced -> paid
```

## SPEC-7.7 Invoice generation

Only the operator/admin can issue official invoices.

Provider Admins can:

- view issued invoices,
- pay issued invoices,
- optionally request invoice issuance.

Provider Admins cannot issue official invoices themselves.

Invoice generation is daily/on-demand for MVP. Conceptually, it represents periodic B2B billing.

Invoice issuance must prevent one charge from appearing on two invoices.
Implementations should lock candidate unbilled charges where supported and
enforce a fresh-database uniqueness constraint on the invoice-line charge
relationship.

## SPEC-7.8 Invoice model

Invoices include:

- invoice ID,
- provider ID/code,
- invoice number,
- billing period start/end,
- subtotal amount,
- optional tax amount,
- total amount,
- currency,
- status,
- issued timestamp,
- paid timestamp,
- invoice lines.

Invoice status values:

```text
draft
issued
paid
cancelled
```

## SPEC-7.9 Mock payment

Payment is mock and full-invoice only.

Payment flow:

1. Provider Admin opens issued unpaid invoice.
2. Provider Admin clicks pay.
3. `billing-service` locks the invoice where supported, verifies no successful
   payment already exists, and creates one payment record.
4. Invoice becomes `paid`.
5. Invoice charges become `paid`.
6. `billing.invoice_paid` event is published.

Out of scope:

- real card/bank payment,
- partial payment,
- refunds,
- real tax/accounting compliance.

## SPEC-7.10 Billing dashboard

Provider Admin sees:

- unpaid amount,
- recent charges,
- issued/paid invoices,
- invoice details,
- pay button for issued invoices,
- pricing currently applied,
- billing date filters.

Operator sees:

- all providers' billing overview,
- unpaid totals,
- paid totals,
- provider balances,
- all invoices,
- invoice issuance UI,
- pricing rules UI.

## SPEC-7.11 Billing and analytics relationship

Billing is the source of truth for SaaS charges, invoices, balances, and
payments between the operator and providers. Analytics may display those
financial summaries only through billing events/snapshots.

Provider `Tracked revenue` is a separate reservation-performance estimate. It
is derived from successful reservation events and represents estimated EV
charging payments to the provider; it is not a billing balance or invoice.

Forbidden:

```text
analytics-service -> direct SQL -> billing-postgres
```

## SPEC-7.12 Consistency

Billing is eventually consistent. If a reservation event reaches billing later, the charge may appear later or in a future invoice.

This is acceptable for the B2B SaaS model.

---

# SPEC-8 - Authentication and Authorization

## SPEC-8.1 Status

Accepted.

## SPEC-8.2 Auth ownership

`auth-service` with `auth-postgres` owns authentication and authorization metadata.

## SPEC-8.3 Login methods

Supported login methods:

- Google OAuth,
- email/password.

Google login is required especially for EV users. Email/password exists for EV users, provider admins, operator, and deterministic demo.

Initial Google sign-in is EV-only. A Google-authenticated email with no existing
account creates an `EV_USER`; later Google sign-ins with the same email return
the same account. Google sign-in must not create or authenticate `OPERATOR` or
`PROVIDER_ADMIN` accounts.

The React frontend may use its own browser callback route for Google OAuth and
then complete the authorization-code exchange through `auth-service`. The
redirect URI used for the authorization request and token exchange must match a
registered Google OAuth redirect URI.

Configured Google OAuth must validate a random `state` value and use PKCE
where compatible with the provider flow. Missing, invalid, expired, or replayed
state values must be rejected. Local placeholder mode may retain an explicit
EV-only demo sign-in endpoint.

Password changes are supported by `auth-service` for local password accounts.
Successful password changes revoke active refresh tokens and require re-login.
The frontend exposes password changes on local-password profiles whose current
session was not signed in with Google.

## SPEC-8.4 Roles

Roles:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

Provider Admins are scoped to their own provider using logical references:

- `provider_id`,
- `provider_code`.

## SPEC-8.5 Token strategy

Use:

- JWT access tokens,
- refresh tokens stored hashed,
- claims including user ID, email, role(s), provider ID/code where applicable, expiration.

Example JWT claims:

```json
{
  "sub": "user-uuid",
  "email": "provider-admin@example.com",
  "roles": ["PROVIDER_ADMIN"],
  "provider_id": "provider-uuid",
  "provider_code": "redPlug",
  "exp": 1718035200
}
```

## SPEC-8.6 Access control

| Feature | EV User | Provider Admin | Operator |
|---|---:|---:|---:|
| Search map/catalog | yes | optional | yes |
| View point details | yes | yes | yes |
| Check status | yes | yes | yes |
| Make reservation | yes | no | no |
| View own reservations | yes | no | no |
| Provider analytics | no | own provider only | all providers |
| Export logs | no | own provider only | all providers |
| View invoices | no | own provider only | all providers |
| Pay invoices | no | own provider only | admin override only if implemented |
| Issue invoices | no | no | yes |
| Edit pricing rules | no | no | yes |
| Trigger provider sync | no | no | yes |
| View global analytics | no | no | yes |

## SPEC-8.7 Seed users

Seed demo users:

| Email | Role |
|---|---|
| `operator@saasplug.local` | `OPERATOR` |
| `evuser@saasplug.local` | `EV_USER` |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` |

Demo passwords must be documented in `.env.example` or README only if safe and intended for local demo.

## SPEC-8.8 Security rules

- Passwords are hashed, never plaintext.
- Provider API keys/secrets are stored securely enough for MVP and never committed.
- `.env` is never committed.
- `.env.example` contains placeholders.
- Services enforce role/provider checks; do not rely only on gateway.

---

# SPEC-9 - Frontend UX, Pages, and User Flows

## SPEC-9.1 Status

Accepted.

## SPEC-9.2 Frontend app

One role-based web app:

```text
apps/frontend
```

Role-based UI areas:

- public/auth pages,
- EV user area,
- provider admin area,
- operator area.

## SPEC-9.3 Auth pages

Required pages:

- `/login`,
- `/register`,
- `/provider-register`,
- `/logout`.

Login page supports Google and email/password.

## SPEC-9.4 EV user pages

Required pages:

- `/map` or `/dashboard`,
- `/points/:id`,
- `/reservations`,
- `/profile`.

The `/reservations` page displays reservation cards and EV-scoped aggregate
summary cards. The current cost-per-energy field is labeled `Cost/kWh`; the
estimated cost field is labeled `Estimated cost` and must clearly remain an
estimate when shown.

## SPEC-9.5 Map behavior

Map loading is viewport/bounds-based.

Example API:

```text
GET /api/catalog/points?minLat=...&maxLat=...&minLng=...&maxLng=...&zoom=...
```

The frontend must debounce map pan/zoom requests.

## SPEC-9.6 Point details UI

Point metadata is read from the cached/local aggregated catalog.

Displayed current status uses `status-service`; the frontend must not render
catalog snapshot status as current availability.

Displayed data:

- provider name/code,
- point name/location,
- address,
- coordinates,
- connector type,
- power/capacity,
- price or `Price unavailable`,
- last catalog sync timestamp,
- last known status,
- last status checked timestamp,
- reserve button.

## SPEC-9.7 Reservation UX

Reservation flow:

1. EV user opens a point quick view from the map/list or opens the full point details.
2. EV user clicks reserve from the point-detail flow.
3. EV user chooses duration where supported.
4. Frontend calls `reservation-service` through gateway.
5. UI shows immediate success/failure.
6. Reservation appears in user's reservation history.
7. Events propagate asynchronously.

## SPEC-9.8 Provider Admin pages

Required pages:

- `/provider/dashboard`,
- `/provider/points`,
- `/provider/analytics`,
- `/provider/invoices`,
- `/provider/invoices/:id`,
- `/provider/export`,
- `/provider/settings`.

Provider Admin limitations:

- cannot issue official invoices,
- cannot edit pricing rules,
- cannot view other providers,
- cannot trigger global sync unless explicitly added later.

## SPEC-9.9 Operator pages

Required pages:

- `/operator/dashboard`,
- `/operator/providers`,
- `/operator/analytics`,
- `/operator/catalog`,
- `/operator/invoices`,
- `/operator/invoices/new`,
- `/operator/pricing`,
- `/operator/sync`,
- `/operator/system`.

## SPEC-9.10 Freshness indicators

Dashboards and point/status views must show freshness indicators:

- analytics computed at,
- catalog last synced at,
- status checked at,
- billing updated at,
- possible delay notices.

## SPEC-9.11 Frontend API route groups

Frontend calls only gateway paths:

```text
/api/auth/*
/api/providers/*
/api/catalog/*
/api/status/*
/api/reservations/*
/api/analytics/*
/api/billing/*
/api/scheduler/*
```

## SPEC-9.12 UX complexity

UI should be clean and functional:

- functional map/list hybrid,
- basic sortable/filterable tables,
- simple charts where useful,
- loading states,
- empty states,
- friendly errors,
- no raw stack traces,
- basic responsiveness.

---

# SPEC-10 - Technology Stack, Repository Structure, and Docker Runtime

## SPEC-10.1 Status

Accepted.

## SPEC-10.2 Technology stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend services | Python + FastAPI |
| Databases | PostgreSQL, one container per stateful service |
| Message broker | RabbitMQ |
| Gateway/reverse proxy | Nginx |
| API style | REST + JSON |
| Data validation | Pydantic |
| DB access | SQLAlchemy/SQLModel models with local `create_all`; Alembic deferred for production hardening |
| Containerization | Docker + Docker Compose |
| Diagrams | PlantUML |
| Backend tests | pytest |
| Frontend tests | Vitest/React Testing Library where useful |
| Python formatting/linting | ruff/black or ruff formatter |
| Frontend formatting/linting | ESLint/Prettier |

## SPEC-10.3 Monorepo structure

Target structure:

```text
apps/
  frontend/

services/
  auth-service/
  provider-registry-service/
  red-provider-service/
  green-provider-service/
  blue-provider-service/
  catalog-service/
  status-service/
  reservation-service/
  analytics-service/
  billing-service/
  scheduler-service/

packages/
  shared-contracts/
  provider-normalization/
  event-contracts/

deploy/
  docker-compose.yml
  nginx/

docs/
  specs/
  decisions/
  diagrams/
    final/
    intermediate/
  ai/

scripts/
```

## SPEC-10.4 Backend service structure

Each backend service should use a consistent structure:

```text
services/<service-name>/
  app/
    main.py
    api/
    core/
    db/
    schemas/
    services/
    clients/
    consumers/
    publishers/
  tests/
  Dockerfile
  pyproject.toml
  README.md
```

Not every folder is required in every service if unused, but consistency is preferred.

## SPEC-10.5 Docker Compose runtime

Docker Compose must run:

- frontend,
- Nginx gateway,
- all backend services,
- RabbitMQ,
- one PostgreSQL container per stateful service.

Only the gateway exposes the public app port. Internal service ports are not public application APIs.

## SPEC-10.6 Ports

Suggested internal ports:

| Component | Internal port |
|---|---:|
| `nginx-gateway` | 80 |
| `auth-service` | 8001 |
| `provider-registry-service` | 8002 |
| `red-provider-service` | 8011 |
| `green-provider-service` | 8012 |
| `blue-provider-service` | 8013 |
| `catalog-service` | 8020 |
| `status-service` | 8021 |
| `reservation-service` | 8030 |
| `analytics-service` | 8040 |
| `billing-service` | 8050 |
| `scheduler-service` | 8060 |
| RabbitMQ AMQP | 5672 |
| RabbitMQ management | 127.0.0.1:15672 in local Docker Compose, dev only |
| PostgreSQL containers | 5432 internal each |

## SPEC-10.7 Gateway routes

Nginx routes:

```text
/api/auth/*          -> auth-service:8001
/api/providers/*     -> provider-registry-service:8002
/api/catalog/*       -> catalog-service:8020
/api/status/*        -> status-service:8021
/api/reservations/*  -> reservation-service:8030
/api/analytics/*     -> analytics-service:8040
/api/billing/*       -> billing-service:8050
/api/scheduler/*     -> scheduler-service:8060
```

The gateway must block browser access to service-owned `/internal/...` routes
and public FastAPI documentation/OpenAPI endpoints in the final demo profile.
It should set standard browser security headers, including CSP, frame
protection, `nosniff`, referrer policy, permissions policy, and COOP.

## SPEC-10.8 Environment configuration

Use `.env` and `.env.example`.

`.env.example` must include placeholders for:

- Google OAuth client ID/secret,
- JWT secret,
- RabbitMQ URL,
- provider base URLs,
- provider API keys/team keys,
- database credentials per service,
- frontend public API base path if needed.

Server-side demo passwords must not be passed to Vite/browser runtime
configuration. Demo credentials are provided out-of-band by the presenter. No
real secrets may be committed.

## SPEC-10.9 Provider OpenAPI handling

Provider adapters must be implemented from the actual OpenAPI YAML specs.

Provider services expose normalized internal APIs such as:

```text
GET /internal/points
GET /internal/points/{external_point_id}/status
POST /internal/points/{external_point_id}/reserve
```

Exact route design may vary, but the internal contract must remain normalized.

## SPEC-10.10 Testing scope

Minimum tests:

- provider payload normalization,
- catalog bounds query,
- status cache hit/miss/expiration,
- reservation success/failure normalization,
- billing event idempotency,
- analytics event idempotency,
- auth login/JWT/role checks,
- basic gateway route smoke tests where practical.

## SPEC-10.11 Codex implementation sequence

Implementation should be staged:

1. repo scaffold and shared contracts,
2. Docker Compose and gateway,
3. auth-service,
4. provider-registry-service,
5. provider services,
6. catalog-service,
7. status-service,
8. reservation-service,
9. RabbitMQ event infrastructure,
10. analytics-service,
11. billing-service,
12. EV frontend flows,
13. provider/operator dashboards,
14. docs, UML, integration tests, final QA.

---

# SPEC-11 - Documentation, UML, GitHub Project, and AI Usage Strategy

## SPEC-11.1 Status

Accepted.

## SPEC-11.2 Final specifications document

This file is the canonical final specifications document:

```text
docs/specs/SPECIFICATIONS.md
```

## SPEC-11.3 Final diagrams path

Final diagrams must be placed under:

```text
docs/diagrams/final/
```

Intermediate/historical diagrams may remain under:

```text
docs/diagrams/intermediate/
```

Only `docs/diagrams/final/` is the final diagram deliverable location.

## SPEC-11.4 UML deliverables

Final PlantUML diagrams must include:

- use case diagram,
- activity diagrams,
- class/data/DTO diagrams,
- API/interface class diagrams,
- component diagram,
- deployment diagram,
- sequence diagrams,
- ER/persistence/data ownership diagram.

Recommended final diagram files:

```text
docs/diagrams/final/use-case.puml
docs/diagrams/final/activity-search-reservation.puml
docs/diagrams/final/activity-provider-sync.puml
docs/diagrams/final/activity-invoice-payment.puml
docs/diagrams/final/component.puml
docs/diagrams/final/deployment.puml
docs/diagrams/final/sequence-map-search.puml
docs/diagrams/final/sequence-status-lookup.puml
docs/diagrams/final/sequence-reservation.puml
docs/diagrams/final/sequence-provider-sync.puml
docs/diagrams/final/sequence-analytics-billing.puml
docs/diagrams/final/data-model.puml
```

## SPEC-11.5 Diagram-code traceability

Diagrams must use exact service names and reference corresponding repository paths where appropriate.

Example:

```text
component "catalog-service\nservices/catalog-service" as Catalog
```

Do not use inconsistent names such as `PointService`, `StatsService`, or `PaymentService`.

## SPEC-11.6 GitHub project management

Codex should attempt direct GitHub project management only if GitHub CLI/API permissions are available.

Direct setup may include:

- issues,
- milestones,
- labels,
- GitHub Project board updates.

If Codex cannot create/update GitHub Projects, issues, milestones, or labels, it must clearly report the failure, likely cause, and what the user must do manually. It must not generate fallback Markdown project-management plans unless explicitly requested.

Project management should remain lightweight, with three milestones/sprints:

1. Architecture & Foundations,
2. Core SaaS Flows,
3. Dashboards & Delivery.

## SPEC-11.7 AI usage documentation

Because the official AI logs subsystem is unavailable, use repository-based manual AI documentation.

Required paths:

```text
docs/ai/prompt-log.md
docs/ai/codex-runs/
```

Each Codex run should create/update a run log containing:

- prompt received,
- goal,
- implementation summary,
- files changed,
- tests run,
- results,
- limitations,
- manual review notes where available.

Exact ChatGPT/Codex answers are captured only when explicitly provided to Codex or when Codex writes its own run report.

## SPEC-11.8 README requirements

README files are required in all major folders, apps, services, packages, docs, deploy, and scripts directories.

Minimum required README files:

```text
README.md
apps/README.md
apps/frontend/README.md
services/README.md
services/auth-service/README.md
services/provider-registry-service/README.md
services/red-provider-service/README.md
services/green-provider-service/README.md
services/blue-provider-service/README.md
services/catalog-service/README.md
services/status-service/README.md
services/reservation-service/README.md
services/analytics-service/README.md
services/billing-service/README.md
packages/README.md
packages/shared-contracts/README.md
packages/provider-normalization/README.md
packages/event-contracts/README.md
deploy/README.md
deploy/nginx/README.md
docs/README.md
docs/specs/README.md
docs/diagrams/README.md
docs/diagrams/final/README.md
docs/ai/README.md
scripts/README.md
```

Each README should state:

- purpose,
- important files,
- commands where relevant,
- dependencies,
- relation to the architecture.

## SPEC-11.9 Root README requirements

Root `README.md` must include:

- project overview,
- architecture summary,
- requirements,
- quick start,
- environment setup,
- Docker Compose run instructions,
- demo users,
- main demo flows,
- provider API integration notes,
- troubleshooting,
- links to specs, diagrams, AI logs.

## SPEC-11.10 Final deliverable checklist

Before submission, verify:

- Docker Compose starts the system,
- frontend is reachable through gateway,
- provider sync works,
- map loads by bounds,
- point details read from catalog,
- status cache works,
- reservation works,
- analytics dashboards work,
- billing/invoices/mock payment work,
- CSV export works,
- operator can issue invoices,
- provider can view/pay invoices,
- final diagrams match code,
- deployment diagram includes ports,
- GitHub project management evidence exists,
- AI documentation exists,
- README files exist in required locations,
- no real secrets are committed.

---

# Appendix A - Accepted SPEC Registry

| SPEC | Title | Status |
|---|---|---|
| SPEC-0 | Sources of Truth and Decision Process | Accepted |
| SPEC-1 | MVP Scope by Actor | Accepted |
| SPEC-2 | Provider API and Data Acquisition Strategy | Accepted |
| SPEC-3 | Microservices Boundaries | Accepted |
| SPEC-4 | Data Ownership and Persistence Strategy | Accepted |
| SPEC-5 | Events, RabbitMQ, and Async Flows | Accepted |
| SPEC-6 | Analytics Design | Accepted |
| SPEC-7 | Billing, Pricing, Invoices, and Mock Payment | Accepted |
| SPEC-8 | Authentication and Authorization | Accepted |
| SPEC-9 | Frontend UX, Pages, and User Flows | Accepted |
| SPEC-10 | Technology Stack, Repository Structure, and Docker Runtime | Accepted |
| SPEC-11 | Documentation, UML, GitHub Project, and AI Usage Strategy | Accepted |

---

# Appendix B - Canonical Service Names

Use exactly these names:

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
scheduler-service
rabbitmq
auth-postgres
provider-registry-postgres
red-provider-postgres
green-provider-postgres
blue-provider-postgres
catalog-postgres
status-postgres
reservation-postgres
analytics-postgres
billing-postgres
scheduler-postgres
```

---

# Appendix C - Canonical Roles

Use exactly these roles:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

---

# Appendix D - Canonical Provider Codes

Use exactly these provider codes:

```text
redPlug
greenPlug
bluePlug
```

---

# Appendix E - Canonical Normalized Status Values

Use exactly these internal status values:

```text
available
charging
reserved
malfunction
offline
unknown
```

---

# Appendix F - Implementation Guardrails for Codex

Codex must:

1. Read `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` before every implementation task.
2. Preserve accepted SPEC decisions.
3. Avoid unrelated refactors.
4. Use canonical service names.
5. Keep all repository content in English.
6. Maintain README files in major folders.
7. Create/update AI run logs for each prompt.
8. Use actual provider YAML specs for adapters.
9. Keep frontend API calls gateway-only.
10. Keep one PostgreSQL container per stateful service.
11. Avoid cross-service DB joins.
12. Use RabbitMQ only where accepted.
13. Report blockers honestly.
14. Run relevant tests and document results.
