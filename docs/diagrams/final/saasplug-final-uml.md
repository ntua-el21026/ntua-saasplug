# saasPlug Final UML Model

This is the self-contained final PlantUML deliverable for the saasPlug submission.
All final diagrams are embedded below as PlantUML blocks in the required deliverable order.
The same sources are also kept as individual `.puml` files under `docs/diagrams/final/` for easier editing and validation.

## Assignment Coverage

| Required UML category | Included diagram(s) |
|---|---|
| Use case | 1 |
| Activity | 2, 3, 4 |
| Component | 5 |
| Deployment | 6 |
| Data design / persistence | 7 |
| Class model for exchanged data structures | 8 |
| Class model for service APIs | 9 |
| Sequence | 10, 11, 12, 13, 14, 15 |

## Naming Conventions

- Actors/roles: `EV User` / `EV_USER`, `Provider Admin` / `PROVIDER_ADMIN`, `Operator` / `OPERATOR`, `External Provider APIs`.
- Provider codes: `redPlug`, `greenPlug`, `bluePlug`.
- Services and containers use the implemented Docker/service names from the repository.
- RabbitMQ exchange: `saasplug.events`; main queues: `analytics.events`, `billing.reservations`, `catalog.provider_snapshots`.

## Diagram Index

| Diagram | Source |
|---|---|
| 1. Use Case Diagram | `use-case.puml` |
| 2. Activity Diagram - Search, Status, Reservation | `activity-search-reservation.puml` |
| 3. Activity Diagram - Provider Sync | `activity-provider-sync.puml` |
| 4. Activity Diagram - Invoice And Payment | `activity-invoice-payment.puml` |
| 5. Component Diagram | `component.puml` |
| 6. Deployment Diagram | `deployment.puml` |
| 7. Data Model Diagram | `data-model.puml` |
| 8. Class Diagram - Exchanged Data Structures | `class-data-structures.puml` |
| 9. Class Diagram - Service APIs | `class-service-apis.puml` |
| 10. Sequence Diagram - Login | `sequence-login.puml` |
| 11. Sequence Diagram - Map Search | `sequence-search-map.puml` |
| 12. Sequence Diagram - Status Lookup | `sequence-status-lookup.puml` |
| 13. Sequence Diagram - Reservation | `sequence-reservation.puml` |
| 14. Sequence Diagram - Provider Sync And Catalog Import | `sequence-provider-sync-catalog-import.puml` |
| 15. Sequence Diagram - Analytics And Billing Events | `sequence-analytics-billing-events.puml` |

## 1. Use Case Diagram

Source: `use-case.puml`

```plantuml
@startuml
title saasPlug final use case model (code-derived)
left to right direction
skinparam packageStyle rectangle
skinparam shadowing false

actor "EV User\n(EV_USER)" as EV
actor "Provider Admin\n(PROVIDER_ADMIN)" as ProviderAdmin
actor "Operator\n(OPERATOR)" as Operator
actor "External Provider APIs\nredPlug / greenPlug / bluePlug" as ExternalProviders
actor "Scheduler service" as Scheduler

rectangle "saasPlug platform" {
  usecase "Register and login\nlocal credentials or Google OAuth" as Auth
  usecase "View profile\nand change password" as Profile

  usecase "Search charging points\nviewport radius, filters, paging" as Search
  usecase "View point details\nand record point view" as PointDetail
  usecase "Check point status\ncache hit, live refresh, fallback" as StatusLookup
  usecase "Reserve charging point\nidempotent request and point lock" as Reserve
  usecase "View own reservations" as OwnReservations
  usecase "View EV analytics summary" as EvAnalytics

  usecase "View provider dashboard\nanalytics, invoices, export" as ProviderDashboard
  usecase "Manage own provider settings" as ProviderSettings
  usecase "View provider catalog points" as ProviderPoints
  usecase "Pay provider invoice\nmock full payment" as PayInvoice

  usecase "Manage provider registry\ncreate, patch, activate/deactivate" as ProviderRegistry
  usecase "Run catalog sync\nall providers or one provider" as CatalogSync
  usecase "Operate scheduler\njobs, intervals, manual runs" as SchedulerOps
  usecase "View operator analytics\ncatalog, billing, system health" as OperatorAnalytics
  usecase "Manage pricing rules\nand issue invoices" as BillingOps
  usecase "Drain event outboxes\nreservation and billing" as OutboxOps

  usecase "Adapt provider APIs\nlist, detail/status, reserve/hold" as ProviderAdapters
}

EV --> Auth
EV --> Profile
EV --> Search
EV --> PointDetail
EV --> StatusLookup
EV --> Reserve
EV --> OwnReservations
EV --> EvAnalytics

ProviderAdmin --> Auth
ProviderAdmin --> Profile
ProviderAdmin --> ProviderDashboard
ProviderAdmin --> ProviderSettings
ProviderAdmin --> ProviderPoints
ProviderAdmin --> PayInvoice

Operator --> Auth
Operator --> Profile
Operator --> ProviderRegistry
Operator --> CatalogSync
Operator --> SchedulerOps
Operator --> OperatorAnalytics
Operator --> BillingOps
Operator --> OutboxOps

Scheduler --> CatalogSync
Scheduler --> OutboxOps
Scheduler --> OperatorAnalytics
Scheduler --> BillingOps

Search .> StatusLookup : <<include>>
PointDetail .> StatusLookup : <<include>>
Reserve .> PointDetail : <<include>>
Reserve .> StatusLookup : <<include>>
CatalogSync .> ProviderAdapters : <<include>>
StatusLookup .> ProviderAdapters : <<include>>
Reserve .> ProviderAdapters : <<include>>
ExternalProviders --> ProviderAdapters

note bottom of ProviderAdapters
Provider adapters are internal FastAPI services.
They store local snapshots and call the external provider APIs.
They do not publish RabbitMQ events in the implemented runtime.
end note
@enduml
```

## 2. Activity Diagram - Search, Status, Reservation

Source: `activity-search-reservation.puml`

```plantuml
@startuml
title EV search, status lookup, and reservation activity
skinparam shadowing false

start

partition "EV User / React frontend" {
  :Open /map or point detail;
  :Hold access token from auth-service login;
  :Derive centerLat, centerLng, radiusKm\nfrom map viewport;
  :Apply filters q, providerCode, status,\nconnector, includeStale, limit, offset;
}

partition "nginx-gateway" {
  :Proxy /api/catalog/points to catalog-service;
}

partition "catalog-service" {
  :Validate circle radius\n(max 10 km);
  :Query catalog_points owned by catalog-postgres;
  :Return CatalogPointListResponse\nwith search_circle metadata;
  :Best-effort publish usage.search_performed;
}

partition "React frontend" {
  :Render points on map and list;
  :Request cache-only statuses for visible points;
}

partition "status-service" {
  :POST /cache/statuses reads status_cache only;
  :Return cached statuses and cache metadata;
}

partition "React frontend" {
  if (User selects point?) then (yes)
    :Request catalog detail and record view;
  else (no)
    stop
  endif
}

partition "catalog-service" {
  :Read catalog point detail;
  :Best-effort publish usage.point_viewed;
}

partition "React frontend" {
  :Request live status for selected point\nor force refresh;
}

partition "status-service" {
  if (Fresh cache and no force refresh?) then (yes)
    :Return cached status;
    :Publish status.point_checked\n(cache_hit=true);
  else (no)
    :Acquire per-point in-process lock;
    :Call provider adapter\n/internal/points/{externalPointId}/status;
  endif
}

partition "Provider adapter service" {
  :Call external provider detail/status API;
  :Store raw payload and local normalized snapshot;
}

partition "status-service" {
  if (Provider status succeeds?) then (yes)
    :Upsert status_cache;
    :Append status_check_logs;
    :Publish status.point_checked\n(source=provider_live);
    :Return live status;
  else (no)
    if (Stale cache exists?) then (yes)
      :Record provider error;
      :Return stale cached status with warning;
      :Publish status.point_checked\n(source=cache_fallback);
    else (no)
      :Write failed status_check_logs;
      :Publish status.point_checked error metadata;
      :Return lookup error;
      stop
    endif
  endif
}

partition "React frontend" {
  if (EV reserves point?) then (yes)
    :Send POST /api/reservations/points/{provider}/{id}/reservations\nwith duration and idempotency key;
  else (no)
    stop
  endif
}

partition "reservation-service" {
  :Resolve catalog point through catalog-service;
  :Create/read reservation_idempotency_records;
  :Acquire reservation_point_locks;
  :Reject conflicting active successful reservation;
  :Call provider adapter reservation endpoint;
}

partition "Provider adapter service" {
  :Call external reserve/hold API\nwith provider-specific path/body/query;
  :Return normalized reservation payload;
}

partition "reservation-service" {
  if (Provider confirms future reservation end?) then (yes)
    :Store succeeded reservation and attempt;
    :Estimate energy and reservation cost;
    :Seed status cache as reserved through status-service internal API;
    :Stage reservation.succeeded in reservation_event_outbox;
    :Return ReservationResponse;
  else (ambiguous or failed)
    :Store failed or unknown reservation outcome;
    :Store provider attempt and reconciliation metadata;
    :Stage reservation.failed when applicable;
    :Return error or unknown outcome;
  endif
}

partition "scheduler-service / operator job" {
  :Call reservation-service outbox drain;
  :Publish pending reservation events to RabbitMQ;
}

stop
@enduml
```

## 3. Activity Diagram - Provider Sync

Source: `activity-provider-sync.puml`

```plantuml
@startuml
title Provider adapter sync and catalog import activity
skinparam shadowing false

start

partition "Operator or scheduler-service" {
  :Trigger catalog import\nall providers or one provider;
}

partition "catalog-service" {
  :Validate operator or X-Scheduler-Token;
  :Create catalog_import_runs row;
  :Acquire catalog_import_locks row\nfor provider_code;
  if (Lock acquired?) then (yes)
    :Call provider adapter POST /internal/sync;
  else (no)
    :Mark import skipped/conflict;
    stop
  endif
}

partition "Provider adapter service\nred / green / blue" {
  :Read provider integration configuration;
  :Call external list endpoint;
  :Store raw_provider_payloads;
  :Normalize provider fields to saasPlug shape;
  :Upsert provider_point_snapshots;
  :Record provider_point_changes and provider_sync_runs;
  :Return SyncSummaryResponse;
}

partition "catalog-service" {
  :Call provider adapter GET /internal/points;
  :Read normalized provider snapshots;
  :Upsert catalog_points;
  :Record catalog_point_changes;
  :Mark missing points stale/inactive as needed;
  :Complete catalog_import_runs;
  :Release catalog_import_locks;
  :Seed imported statuses through\nstatus-service /internal/cache/seed;
  :Best-effort publish catalog.points.imported;
}

partition "status-service" {
  :Upsert status_cache from imported snapshots;
}

partition "RabbitMQ saasplug.events" {
  :Route catalog.points.imported\nto analytics.events;
}

partition "analytics-service" {
  :Consume analytics.events during drain;
  :Store usage_events and catalog_health_snapshots;
  :Refresh provider/operator aggregates when job runs;
}

note right
The events package declares provider.sync.requested,
provider.points.snapshot_ready, and catalog.provider_snapshots,
but the implemented provider adapter services do not publish RabbitMQ events.
The live import path is catalog-service -> provider adapter -> catalog-service.
end note

stop
@enduml
```

## 4. Activity Diagram - Invoice And Payment

Source: `activity-invoice-payment.puml`

```plantuml
@startuml
title Billing charge, invoice issuance, and payment activity
skinparam shadowing false

start

partition "RabbitMQ billing.reservations queue" {
  :Hold reservation.succeeded,\nreservation.failed, and usage.point_viewed events;
}

partition "scheduler-service or operator" {
  :Trigger billing-service event drain;
}

partition "billing-service" {
  :Consume bounded batch from billing.reservations;
  :Persist billing_events idempotently;
  if (Event is reservation.succeeded?) then (yes)
    :Create reservation_success charge;
  elseif (Event is usage.point_viewed and fee enabled?) then (yes)
    :Create point_view charge;
  elseif (Event is reservation.failed and failure fee > 0?) then (yes)
    :Create reservation_failure charge;
  else (no billable charge)
    :Record event as skipped;
  endif
  :Stage billing.charge_created in billing_event_outbox\nwhen a charge is created;
}

partition "Operator frontend" {
  :Open invoices page;
  :POST /api/billing/invoices/issue\nwith provider, period, due date;
}

partition "billing-service" {
  :Select unbilled charge_records for provider/period;
  if (Unbilled charges exist?) then (yes)
    :Create invoices and invoice_lines;
    :Mark charge_records invoiced;
    :Stage billing.invoice_issued in billing_event_outbox;
    :Return InvoiceResponse;
  else (no)
    :Return 409 no_unbilled_charges;
  endif
}

partition "Provider admin or operator frontend" {
  :Open invoice detail;
  :POST /api/billing/invoices/{invoice_id}/pay\nwith mock full payment;
}

partition "billing-service" {
  if (Invoice already paid?) then (yes)
    :Reject duplicate payment;
  else (no)
    :Create payments row;
    :Mark invoice paid and charge_records paid;
    :Stage billing.invoice_paid in billing_event_outbox;
    :Return paid invoice;
  endif
}

partition "scheduler-service or operator" {
  :Trigger billing outbox publisher;
}

partition "RabbitMQ saasplug.events" {
  :Publish billing.charge_created,\nbilling.invoice_issued,\nbilling.invoice_paid;
  :Route billing events to analytics.events;
}

partition "analytics-service" {
  :Consume analytics.events;
  :Persist billing summary snapshots;
  :Refresh provider/operator billing metrics;
}

stop
@enduml
```

## 5. Component Diagram

Source: `component.puml`

```plantuml
@startuml
title saasPlug final component model (repository and runtime aligned)
left to right direction
skinparam componentStyle rectangle
skinparam shadowing false

actor "EV User" as EV
actor "Provider Admin" as ProviderAdmin
actor "Operator" as Operator

component "Browser\nrole-based React app" as Browser
component "frontend\napps/frontend\nReact/Vite static build\nserved by Nginx on :5173" as Frontend
component "nginx-gateway\ndeploy/nginx/default.conf\npublic HTTP :8080 -> container :80" as Gateway

package "FastAPI services\ninternal Docker port :8000" {
  component "auth-service\nservices/auth-service" as Auth
  component "provider-registry-service\nservices/provider-registry-service" as ProviderRegistry
  component "red-provider-service\nservices/red-provider-service\n/internal only" as RedProvider
  component "green-provider-service\nservices/green-provider-service\n/internal only" as GreenProvider
  component "blue-provider-service\nservices/blue-provider-service\n/internal only" as BlueProvider
  component "catalog-service\nservices/catalog-service" as Catalog
  component "status-service\nservices/status-service" as Status
  component "reservation-service\nservices/reservation-service" as Reservation
  component "analytics-service\nservices/analytics-service" as Analytics
  component "billing-service\nservices/billing-service" as Billing
  component "scheduler-service\nservices/scheduler-service" as Scheduler
}

package "Service-owned PostgreSQL databases" {
  database "auth-postgres" as AuthDb
  database "provider-registry-postgres" as ProviderRegistryDb
  database "red-provider-postgres" as RedDb
  database "green-provider-postgres" as GreenDb
  database "blue-provider-postgres" as BlueDb
  database "catalog-postgres" as CatalogDb
  database "status-postgres" as StatusDb
  database "reservation-postgres" as ReservationDb
  database "analytics-postgres" as AnalyticsDb
  database "billing-postgres" as BillingDb
  database "scheduler-postgres" as SchedulerDb
}

queue "rabbitmq\nsaasplug.events exchange\nanalytics.events queue\nbilling.reservations queue" as Rabbit
component "packages/events\nsaasplug_events" as EventsPackage

cloud "External redPlug API" as RedExternal
cloud "External greenPlug API" as GreenExternal
cloud "External bluePlug API" as BlueExternal

EV --> Browser
ProviderAdmin --> Browser
Operator --> Browser
Browser --> Gateway : HTTP / and /api/*
Gateway --> Frontend : /
Gateway --> Auth : /api/auth/* -> /auth/*
Gateway --> ProviderRegistry : /api/providers/* and /api/provider-registry/*
Gateway --> Catalog : /api/catalog/*
Gateway --> Status : /api/status/*
Gateway --> Reservation : /api/reservations/*
Gateway --> Analytics : /api/analytics/*
Gateway --> Billing : /api/billing/*
Gateway --> Scheduler : /api/scheduler/*

Auth --> AuthDb
ProviderRegistry --> ProviderRegistryDb
RedProvider --> RedDb
GreenProvider --> GreenDb
BlueProvider --> BlueDb
Catalog --> CatalogDb
Status --> StatusDb
Reservation --> ReservationDb
Analytics --> AnalyticsDb
Billing --> BillingDb
Scheduler --> SchedulerDb

Catalog --> RedProvider : import via POST /internal/sync\nGET /internal/points
Catalog --> GreenProvider : import via POST /internal/sync\nGET /internal/points
Catalog --> BlueProvider : import via POST /internal/sync\nGET /internal/points
Catalog --> Status : seed imported status cache\nPOST /internal/cache/seed

Status --> RedProvider : live status\nGET /internal/points/{id}/status
Status --> GreenProvider : live status
Status --> BlueProvider : live status

Reservation --> Catalog : resolve catalog point
Reservation --> RedProvider : reserve\nPOST /internal/points/{id}/reservations
Reservation --> GreenProvider : reserve
Reservation --> BlueProvider : reserve
Reservation --> Status : seed reserved status cache

Scheduler --> Catalog : internal catalog import jobs
Scheduler --> Reservation : reservation outbox publish job
Scheduler --> Billing : billing drain, invoice, outbox jobs
Scheduler --> Analytics : consume events and refresh aggregates

RedProvider --> RedExternal : /points, /point/{id}, /reserve/{id}/{minutes}
GreenProvider --> GreenExternal : /chargingPoints,\n/chargingPoints/{id}/reservations
BlueProvider --> BlueExternal : /locations,\n/location/{id}/status,\n/location/{id}/hold?minutes

Catalog --> Rabbit : publish usage.search_performed,\nusage.point_viewed,\ncatalog.points.imported
Status --> Rabbit : publish status.point_checked
Reservation --> Rabbit : outbox drain publishes\nreservation.succeeded / reservation.failed
Billing --> Rabbit : outbox drain publishes\nbilling.charge_created,\nbilling.invoice_issued,\nbilling.invoice_paid
Rabbit --> Analytics : deliver analytics.events
Rabbit --> Billing : deliver billing.reservations

EventsPackage ..> Catalog : publisher helpers
EventsPackage ..> Status : publisher helpers
EventsPackage ..> Reservation : outbox publisher helpers
EventsPackage ..> Billing : consumer and publisher helpers
EventsPackage ..> Analytics : consumer helpers

note bottom of Gateway
Gateway blocks service-owned internal job prefixes for catalog, reservations,
analytics, and billing. Scheduler calls internal job endpoints over the Docker network.
end note

note right of Rabbit
The events package also declares provider.sync.requested,
provider.points.snapshot_ready, and catalog.provider_snapshots.
Those are topology definitions only in the current code path:
provider adapters do not publish RabbitMQ events.
end note
@enduml
```

## 6. Deployment Diagram

Source: `deployment.puml`

```plantuml
@startuml
title saasPlug final deployment model (Docker Compose)
left to right direction
skinparam shadowing false

node "Developer / presentation machine" as Host {
  artifact "Browser\nhttp://localhost:8080" as Browser
}

node "Docker Compose project\nnetwork: saasplug-network" as Compose {
  node "nginx-gateway\nimage nginx:1.27-alpine\nhost 8080 by default -> container 80" as Gateway

  node "frontend\napps/frontend Dockerfile\nbuild: Node 20\nruntime: nginx:1.27-alpine\ninternal port 5173" as Frontend

  node "FastAPI application containers\nPython 3.12 / Uvicorn\ninternal port 8000 each" as Services {
    component "auth-service" as Auth
    component "provider-registry-service" as ProviderRegistry
    component "red-provider-service" as RedProvider
    component "green-provider-service" as GreenProvider
    component "blue-provider-service" as BlueProvider
    component "catalog-service" as Catalog
    component "status-service" as Status
    component "reservation-service" as Reservation
    component "analytics-service" as Analytics
    component "billing-service" as Billing
    component "scheduler-service" as Scheduler
  }

  queue "rabbitmq\nimage rabbitmq:3-management\nAMQP 5672 internal\nmanagement 127.0.0.1:15672 by default\nvolume rabbitmq-data" as Rabbit

  database "auth-postgres\npostgres:16-alpine\n5432 internal\nvolume auth-postgres-data" as AuthDb
  database "provider-registry-postgres\nvolume provider-registry-postgres-data" as ProviderRegistryDb
  database "red-provider-postgres\nvolume red-provider-postgres-data" as RedDb
  database "green-provider-postgres\nvolume green-provider-postgres-data" as GreenDb
  database "blue-provider-postgres\nvolume blue-provider-postgres-data" as BlueDb
  database "catalog-postgres\nvolume catalog-postgres-data" as CatalogDb
  database "status-postgres\nvolume status-postgres-data" as StatusDb
  database "reservation-postgres\nvolume reservation-postgres-data" as ReservationDb
  database "analytics-postgres\nvolume analytics-postgres-data" as AnalyticsDb
  database "billing-postgres\nvolume billing-postgres-data" as BillingDb
  database "scheduler-postgres\nvolume scheduler-postgres-data" as SchedulerDb
}

cloud "External provider API hosts" as ProviderApis {
  component "redPlug" as RedApi
  component "greenPlug" as GreenApi
  component "bluePlug" as BlueApi
}

Browser --> Gateway : HTTP host port\nGATEWAY_HTTP_PORT default 8080
Gateway --> Frontend : /
Gateway --> Auth : /api/auth/*
Gateway --> ProviderRegistry : /api/providers/*\n/api/provider-registry/*
Gateway --> Catalog : /api/catalog/*
Gateway --> Status : /api/status/*
Gateway --> Reservation : /api/reservations/*
Gateway --> Analytics : /api/analytics/*
Gateway --> Billing : /api/billing/*
Gateway --> Scheduler : /api/scheduler/*

Auth --> AuthDb : PostgreSQL 5432 internal
ProviderRegistry --> ProviderRegistryDb
RedProvider --> RedDb
GreenProvider --> GreenDb
BlueProvider --> BlueDb
Catalog --> CatalogDb
Status --> StatusDb
Reservation --> ReservationDb
Analytics --> AnalyticsDb
Billing --> BillingDb
Scheduler --> SchedulerDb

Catalog --> RedProvider : Docker DNS\nprovider import
Catalog --> GreenProvider
Catalog --> BlueProvider
Status --> RedProvider : live status
Status --> GreenProvider
Status --> BlueProvider
Reservation --> RedProvider : reservation mutation
Reservation --> GreenProvider
Reservation --> BlueProvider

Scheduler --> Catalog : internal jobs\nX-Scheduler-Token
Scheduler --> Reservation : internal outbox job
Scheduler --> Billing : internal billing jobs
Scheduler --> Analytics : internal analytics jobs

Catalog --> Rabbit : AMQP 5672 internal
Status --> Rabbit
Reservation --> Rabbit
Billing --> Rabbit
Rabbit --> Analytics : queue delivery
Rabbit --> Billing : queue delivery

RedProvider --> RedApi : HTTPS with Bearer provider API key
GreenProvider --> GreenApi : HTTPS with Bearer provider API key
BlueProvider --> BlueApi : HTTPS with Bearer provider API key

note bottom of Compose
No PostgreSQL service is published to the host.
AMQP is internal to the Docker network.
RabbitMQ management is bound to localhost only.
The frontend container serves the built static app through Nginx, not a development server.
end note
@enduml
```

## 7. Data Model Diagram

Source: `data-model.puml`

```plantuml
@startuml
title saasPlug final service-owned data model
left to right direction
hide circle
skinparam linetype ortho
skinparam shadowing false

package "auth-postgres" {
  entity "users" as auth_users {
    * id : uuid
    --
    email
    password_hash
    auth_provider
    google_subject
    last_login_method
    roles
    provider_id
    provider_code
    is_active
    created_at
    updated_at
  }

  entity "refresh_tokens" as refresh_tokens {
    * id : uuid
    --
    user_id
    token_hash
    expires_at
    revoked_at
    created_at
  }

  entity "oauth_states" as oauth_states {
    * id : uuid
    --
    state_hash
    code_verifier
    expires_at
    consumed_at
    created_at
  }

  auth_users ||--o{ refresh_tokens
}

package "provider-registry-postgres" {
  entity "providers" as providers {
    * id : uuid
    --
    provider_code
    display_name
    legal_name
    contact_email
    api_base_url
    api_key_env_var
    api_auth_type
    api_auth_header
    timeout_seconds
    is_active
    is_seeded
    created_at
    updated_at
  }

  entity "provider_config_audit_logs" as provider_audit {
    * id : uuid
    --
    provider_id
    provider_code
    actor_user_id
    actor_email
    actor_roles
    action
    changed_fields
    created_at
  }

  providers ||--o{ provider_audit
}

package "provider-postgres per adapter\nred / green / blue" {
  entity "provider_point_snapshots" as provider_snapshots {
    * id : uuid
    --
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
  }

  entity "raw_provider_payloads" as raw_payloads {
    * id : uuid
    --
    provider_code
    endpoint
    external_point_id
    payload
    status_code
    fetched_at
  }

  entity "provider_sync_runs" as provider_sync_runs {
    * id : uuid
    --
    provider_code
    status
    started_at
    completed_at
    fetched_count
    upserted_count
    failed_count
    error_message
  }

  entity "provider_point_changes" as provider_changes {
    * id : uuid
    --
    provider_code
    external_point_id
    normalized_point_id
    change_type
    changed_fields
    created_at
  }
}

package "catalog-postgres" {
  entity "catalog_points" as catalog_points {
    * id : uuid
    --
    provider_code
    external_point_id
    normalized_point_id
    display_name
    latitude
    longitude
    status
    reservation_ends_at
    price_per_kwh_eur
    capacity
    connector
    is_active
    is_stale
    last_provider_seen_at
    last_catalog_sync_at
    raw_provider_payload
  }

  entity "catalog_import_runs" as catalog_import_runs {
    * id : uuid
    --
    provider_code
    status
    triggered_by
    provider_sync_triggered
    provider_fetched_count
    catalog_upserted_count
    catalog_changed_count
    catalog_marked_stale_count
    error_message
    started_at
    completed_at
  }

  entity "catalog_import_locks" as catalog_import_locks {
    * provider_code
    --
    owner_run_id
    acquired_at
    expires_at
  }

  entity "catalog_point_changes" as catalog_changes {
    * id : uuid
    --
    provider_code
    external_point_id
    normalized_point_id
    changed_fields
    created_at
  }
}

package "status-postgres" {
  entity "status_cache" as status_cache {
    * id : uuid
    --
    provider_code
    external_point_id
    status
    reservation_ends_at
    price_per_kwh_eur
    capacity
    connector
    fetched_at
    expires_at
    source
    provider_error
  }

  entity "status_cache_policy" as status_policy {
    * id : uuid
    --
    ttl_seconds
    stale_ttl_seconds
    updated_at
  }

  entity "status_check_logs" as status_logs {
    * id : uuid
    --
    provider_code
    external_point_id
    cache_hit
    force_refresh
    provider_called
    returned_stale
    status
    source
    error_message
    checked_at
  }
}

package "reservation-postgres" {
  entity "reservations" as reservations {
    * id : uuid
    --
    user_id
    provider_code
    external_point_id
    status
    duration_minutes
    reservation_starts_at
    reservation_ends_at
    estimated_energy_kwh
    estimated_cost_eur
    reconciliation_required
    created_at
    updated_at
  }

  entity "reservation_attempts" as reservation_attempts {
    * id : uuid
    --
    reservation_id
    provider_code
    external_point_id
    outcome_status
    provider_status_code
    provider_response
    error_message
    created_at
  }

  entity "reservation_idempotency_records" as reservation_idem {
    * id : uuid
    --
    idempotency_key
    user_id
    request_hash
    reservation_id
    status
    response_payload
    created_at
    updated_at
  }

  entity "reservation_point_locks" as reservation_locks {
    * provider_code + external_point_id
    --
    owner_reservation_id
    acquired_at
    expires_at
  }

  entity "reservation_event_outbox" as reservation_outbox {
    * id : uuid
    --
    event_type
    event_payload
    status
    attempts
    next_attempt_at
    published_at
    created_at
  }

  reservations ||--o{ reservation_attempts
  reservations ||--o{ reservation_idem
}

package "analytics-postgres" {
  entity "usage_events" as usage_events {
    * id : uuid
    --
    event_id
    event_type
    provider_code
    external_point_id
    user_id
    occurred_at
    payload
  }

  entity "provider_hourly_metrics" as provider_hourly
  entity "provider_daily_metrics" as provider_daily
  entity "point_daily_metrics" as point_daily
  entity "provider_status_daily_metrics" as status_daily
  entity "operator_daily_metrics" as operator_daily
  entity "ev_reservation_daily_metrics" as ev_daily
  entity "catalog_health_snapshots" as catalog_health
  entity "billing_summary_snapshots" as billing_summary
  entity "export_jobs" as export_jobs
}

package "billing-postgres" {
  entity "pricing_rules" as pricing_rules
  entity "billing_events" as billing_events {
    * id : uuid
    --
    event_id
    event_type
    provider_code
    billable
    processed_status
    payload
    occurred_at
  }

  entity "charge_records" as charge_records {
    * id : uuid
    --
    billing_event_id
    provider_code
    charge_type
    amount_eur
    invoice_id
    paid_at
    created_at
  }

  entity "invoices" as invoices {
    * id : uuid
    --
    provider_code
    invoice_number
    status
    period_start
    period_end
    subtotal_eur
    total_eur
    due_date
    paid_at
  }

  entity "invoice_lines" as invoice_lines {
    * id : uuid
    --
    invoice_id
    charge_record_id
    description
    amount_eur
  }

  entity "payments" as payments
  entity "billing_event_outbox" as billing_outbox {
    * id : uuid
    --
    event_type
    event_payload
    status
    attempts
    next_attempt_at
    published_at
    created_at
  }

  billing_events ||--o{ charge_records
  invoices ||--o{ invoice_lines
  invoices ||--o{ payments
  charge_records ||--o{ invoice_lines
}

package "scheduler-postgres" {
  entity "scheduled_jobs" as scheduled_jobs {
    * id : uuid
    --
    job_key
    target_service
    target_path
    interval_seconds
    cron_expression
    timezone
    enabled
    paused
    updated_at
  }

  entity "job_runs" as job_runs {
    * id : uuid
    --
    job_key
    status
    started_at
    completed_at
    target_http_status
    response_summary
    attempt_count
  }

  scheduled_jobs ||--o{ job_runs
}

providers .. catalog_points : provider_code logical ownership
provider_snapshots .. catalog_points : imported normalized snapshots
catalog_points .. status_cache : provider_code + external_point_id
catalog_points .. reservations : provider_code + external_point_id
reservations .. charge_records : reservation events create charges
charge_records .. billing_summary : billing events feed analytics
usage_events .. provider_daily : aggregate refresh

note bottom
Each package is a separate PostgreSQL container and service ownership boundary.
Cross-package links are logical data flow relationships, not cross-database foreign keys.
end note
@enduml
```

## 8. Class Diagram - Exchanged Data Structures

Source: `class-data-structures.puml`

```plantuml
@startuml
title saasPlug exchanged data structures and event payload classes
left to right direction
skinparam classAttributeIconSize 0
skinparam shadowing false

package "Auth DTOs" {
  enum UserRole {
    EV_USER
    PROVIDER_ADMIN
    OPERATOR
  }
  class RegisterRequest {
    email: EmailStr
    password: string
    roles: UserRole[]
    provider_code: string?
  }
  class LoginRequest {
    email: EmailStr
    password: string
  }
  class AuthTokenResponse {
    access_token: string
    refresh_token: string
    token_type: bearer
    user: UserResponse
  }
  class UserResponse {
    id: UUID
    email: string
    roles: UserRole[]
    provider_code: string?
    is_active: bool
  }
}

package "Provider registry DTOs" {
  class ProviderCreateRequest {
    provider_code: string
    display_name: string
    api_base_url: AnyUrl
    api_key_env_var: string
  }
  class ProviderUpdateRequest {
    display_name: string?
    contact_email: EmailStr?
    api_base_url: AnyUrl?
    is_active: bool?
  }
  class ProviderResponse {
    id: UUID
    provider_code: string
    display_name: string
    is_active: bool
  }
  class ProviderIntegrationConfigResponse {
    provider_code: string
    api_base_url: string
    api_auth_type: string
    timeout_seconds: int
  }
}

package "Provider adapter DTOs" {
  class ProviderIdentityResponse {
    provider_code: string
    display_name: string
  }
  class NormalizedPointResponse {
    provider_code: string
    external_point_id: string
    normalized_point_id: string
    latitude: decimal
    longitude: decimal
    status: string
    reservation_ends_at: datetime?
    price_per_kwh_eur: decimal?
    capacity: decimal?
    connector: string?
  }
  class StatusResponse {
    provider_code: string
    external_point_id: string
    status: string
    reservation_ends_at: datetime?
    source: provider_live
  }
  class ReservationRequest {
    duration_minutes: int
  }
  class NormalizedReservationResponse {
    provider_code: string
    external_point_id: string
    status: string
    reservation_ends_at: datetime?
    raw_payload: object
  }
  class SyncSummaryResponse {
    provider_code: string
    fetched_count: int
    upserted_count: int
    failed_count: int
    status: string
  }
}

package "Catalog and status DTOs" {
  class CatalogSearchCircleResponse {
    center_lat: decimal
    center_lng: decimal
    radius_km: decimal
  }
  class CatalogPointResponse {
    provider_code: string
    external_point_id: string
    display_name: string
    latitude: decimal
    longitude: decimal
    status: string
    price_per_kwh_eur: decimal?
    connector: string?
    is_stale: bool
  }
  class CatalogPointListResponse {
    items: CatalogPointResponse[]
    limit: int
    offset: int
    total: int
    search_circle: CatalogSearchCircleResponse?
  }
  class PointViewRequest {
    view_source: string
    status: string?
  }
  class StatusBatchLookupRequest {
    points: StatusBatchLookupItem[]
    force_refresh: bool
  }
  class StatusLookupResponse {
    provider_code: string
    external_point_id: string
    status: string
    cache_hit: bool
    provider_called: bool
    returned_stale: bool
    source: string
  }
  class StatusCachePolicyResponse {
    ttl_seconds: int
    stale_ttl_seconds: int
  }
}

package "Reservation DTOs" {
  class ReservationCreateRequest {
    duration_minutes: int
    idempotency_key: string?
  }
  class ReservationResponse {
    id: UUID
    user_id: UUID
    provider_code: string
    external_point_id: string
    status: string
    reservation_ends_at: datetime?
    estimated_energy_kwh: decimal?
    estimated_cost_eur: decimal?
    reconciliation_required: bool
  }
  class ReservationAttemptResponse {
    id: UUID
    reservation_id: UUID
    outcome_status: string
    provider_status_code: int?
  }
  class OutboxPublishResponse {
    published_count: int
    failed_count: int
  }
}

package "Billing, analytics, scheduler DTOs" {
  class PricingRuleResponse {
    provider_code: string
    reservation_success_fee_eur: decimal
    point_view_fee_enabled: bool
    reservation_failure_fee_eur: decimal
  }
  class ChargeResponse {
    id: UUID
    provider_code: string
    charge_type: string
    amount_eur: decimal
  }
  class InvoiceResponse {
    id: UUID
    provider_code: string
    invoice_number: string
    status: string
    total_eur: decimal
    lines: InvoiceLineResponse[]
    payments: PaymentResponse[]
  }
  class ProviderSummaryResponse {
    provider_code: string
    total_reservations: int
    revenue_eur: decimal
    status_distribution: object
  }
  class OperatorSummaryResponse {
    providers_count: int
    active_points: int
    revenue_eur: decimal
  }
  class ScheduledJobResponse {
    job_key: string
    target_service: string
    target_path: string
    enabled: bool
    paused: bool
  }
  class JobRunResponse {
    id: UUID
    job_key: string
    status: string
    target_http_status: int?
  }
}

package "Event envelope" {
  class EventEnvelope {
    event_id: UUID
    event_type: EventType
    event_version: string
    occurred_at: datetime
    correlation_id: string
    producer: string
    payload: object
  }
  enum EventType {
    PROVIDER_SYNC_REQUESTED
    PROVIDER_POINTS_SNAPSHOT_READY
    CATALOG_POINTS_IMPORTED
    USAGE_SEARCH_PERFORMED
    USAGE_POINT_VIEWED
    STATUS_POINT_CHECKED
    RESERVATION_SUCCEEDED
    RESERVATION_FAILED
    BILLING_CHARGE_CREATED
    BILLING_INVOICE_ISSUED
    BILLING_INVOICE_PAID
  }
}

AuthTokenResponse --> UserResponse
RegisterRequest --> UserRole
UserResponse --> UserRole
CatalogPointListResponse --> CatalogPointResponse
CatalogPointListResponse --> CatalogSearchCircleResponse
InvoiceResponse --> ChargeResponse
EventEnvelope --> EventType

note bottom of EventType
Exact event routing strings are defined in packages/events/saasplug_events:
provider.sync.requested, provider.points.snapshot_ready, catalog.points.imported,
usage.search_performed, usage.point_viewed, status.point_checked,
reservation.succeeded, reservation.failed, billing.charge_created,
billing.invoice_issued, billing.invoice_paid.
end note
@enduml
```

## 9. Class Diagram - Service APIs

Source: `class-service-apis.puml`

```plantuml
@startuml
title saasPlug service API class model (public and internal APIs)
left to right direction
skinparam classAttributeIconSize 0
skinparam shadowing false

interface "AuthPublicApi" as AuthApi {
  +register()
  +login()
  +refresh()
  +logout()
  +change_password()
  +me()
  +google_login()
  +google_callback()
}

interface "ProviderRegistryApi" as RegistryApi {
  +list_providers()
  +get_provider()
  +create_provider()
  +patch_provider()
  +patch_status()
  +get_integration_config()
  +list_audit_logs()
}

interface "ProviderAdapterInternalApi" as ProviderAdapterApi {
  +identity()
  +list_points()
  +sync()
  +get_point()
  +get_status()
  +reserve()
  +list_sync_runs()
}

interface "CatalogApi" as CatalogApi {
  +list_points()
  +get_point()
  +record_point_view()
  +import_provider()
  +import_all()
  +list_import_runs()
  +freshness()
}

interface "StatusApi" as StatusApi {
  +cache_batch()
  +live_batch()
  +get_point_status()
  +get_cache_entry()
  +get_cache_policy()
  +patch_cache_policy()
  +list_logs()
  +freshness()
}

interface "ReservationApi" as ReservationApi {
  +create_reservation()
  +my_reservations()
  +admin_list_reservations()
  +get_reservation()
  +list_attempts()
  +list_outbox()
  +publish_outbox()
}

interface "AnalyticsApi" as AnalyticsApi {
  +ingest_event()
  +consume_events()
  +refresh_aggregates()
  +provider_summary()
  +provider_trends()
  +provider_top_points()
  +operator_summary()
  +operator_catalog_health()
  +ev_reservation_summary()
  +export_usage_csv()
}

interface "BillingApi" as BillingApi {
  +ingest_event()
  +drain_events()
  +publish_outbox()
  +list_pricing_rules()
  +patch_pricing_rule()
  +effective_pricing()
  +list_charges()
  +issue_invoice()
  +list_invoices()
  +get_invoice()
  +pay_invoice()
  +overview()
}

interface "SchedulerApi" as SchedulerApi {
  +list_jobs()
  +get_job()
  +patch_job()
  +manual_run()
  +pause_job()
  +resume_job()
  +apply_minimum_intervals()
  +reset_default_intervals()
  +run_maintenance()
  +list_runs()
  +health()
}

interface "InternalJobApi" as InternalJobApi {
  +catalog_import_all()
  +catalog_import_provider()
  +reservation_publish_outbox()
  +analytics_consume_events()
  +analytics_refresh_aggregates()
  +billing_drain_events()
  +billing_publish_outbox()
  +billing_prepare_invoices()
}

AuthApi ..> RegistryApi : provider-scoped roles
CatalogApi ..> ProviderAdapterApi : sync and read normalized snapshots
CatalogApi ..> StatusApi : seed cache after imports
StatusApi ..> ProviderAdapterApi : live status lookup
ReservationApi ..> CatalogApi : resolve point
ReservationApi ..> ProviderAdapterApi : reserve point
ReservationApi ..> StatusApi : seed reserved cache
SchedulerApi ..> InternalJobApi : Docker-internal calls
InternalJobApi ..> CatalogApi
InternalJobApi ..> ReservationApi
InternalJobApi ..> BillingApi
InternalJobApi ..> AnalyticsApi

note right of AuthApi
Gateway external paths:
/api/auth/auth/register
/api/auth/auth/login
/api/auth/auth/refresh
/api/auth/auth/logout
/api/auth/auth/password
/api/auth/auth/me
/api/auth/auth/google/login
/api/auth/auth/google/callback
end note

note right of CatalogApi
Public gateway prefix: /api/catalog
Important routes:
GET /points with centerLat, centerLng, radiusKm
GET /points/{provider_code}/{external_point_id}
POST /points/{provider_code}/{external_point_id}/views
POST /imports/all
POST /imports/providers/{provider_code}
Internal scheduler routes under /internal/jobs/catalog/*
end note

note right of StatusApi
Public gateway prefix: /api/status
Cache-only batch: POST /cache/statuses
Live batch: POST /points/statuses
Single live lookup:
GET /points/{provider_code}/{external_point_id}/status
Internal cache seed: POST /internal/cache/seed
end note

note right of ProviderAdapterApi
Provider adapters are not exposed by nginx-gateway.
Internal prefix: /internal
GET /points
POST /sync
GET /points/{external_point_id}
GET /points/{external_point_id}/status
POST /points/{external_point_id}/reservations
end note

note right of ReservationApi
Public gateway prefix: /api/reservations
EV create route:
POST /points/{provider_code}/{external_point_id}/reservations
Outbox publishing is operator-only or scheduler-internal.
end note

note right of BillingApi
Public gateway prefix: /api/billing
Invoices: POST /invoices/issue, GET /invoices,
GET /invoices/{invoice_id}, POST /invoices/{invoice_id}/pay.
Event drain and outbox routes are service-owned jobs.
end note

note right of SchedulerApi
Public gateway prefix: /api/scheduler
Scheduler stores job metadata in scheduler-postgres
and calls internal job endpoints with X-Scheduler-Token.
end note
@enduml
```

## 10. Sequence Diagram - Login

Source: `sequence-login.puml`

```plantuml
@startuml
title Login, refresh, and current-user lookup sequence
skinparam shadowing false

actor "User\nEV / Provider Admin / Operator" as User
participant "React frontend\napps/frontend" as Frontend
participant "nginx-gateway\n:8080 -> :80" as Gateway
participant "auth-service\nservices/auth-service :8000" as Auth
database "auth-postgres" as AuthDb

User -> Frontend : Submit email/password
Frontend -> Gateway : POST /api/auth/auth/login
Gateway -> Auth : POST /auth/login
Auth -> AuthDb : Select active user by email\nverify password_hash
Auth -> AuthDb : Insert refresh_tokens row
Auth --> Gateway : AuthTokenResponse\naccess_token, refresh_token, user
Gateway --> Frontend : 200 OK
Frontend --> User : Route by role

Frontend -> Gateway : GET /api/auth/auth/me\nAuthorization: Bearer access token
Gateway -> Auth : GET /auth/me
Auth -> AuthDb : Load user and roles
Auth --> Gateway : UserResponse
Gateway --> Frontend : UserResponse

alt Access token expires
  Frontend -> Gateway : POST /api/auth/auth/refresh
  Gateway -> Auth : POST /auth/refresh
  Auth -> AuthDb : Validate refresh_tokens token_hash
  Auth --> Gateway : New AuthTokenResponse
  Gateway --> Frontend : New access token
end

alt Google OAuth configured
  User -> Frontend : Choose Google login
  Frontend -> Gateway : GET /api/auth/auth/google/login
  Gateway -> Auth : GET /auth/google/login
  Auth -> AuthDb : Store oauth_states\nstate_hash and PKCE verifier
  Auth --> Gateway : Google authorization URL
  Gateway --> Frontend : URL
  User -> Gateway : GET /api/auth/auth/google/callback?code&state
  Gateway -> Auth : GET /auth/google/callback
  Auth -> AuthDb : Consume oauth_states and upsert/load user
  Auth -> AuthDb : Insert refresh_tokens row
  Auth --> Gateway : AuthTokenResponse
  Gateway --> Frontend : Callback completes session
end

@enduml
```

## 11. Sequence Diagram - Map Search

Source: `sequence-search-map.puml`

```plantuml
@startuml
title Viewport-radius catalog map search sequence
skinparam shadowing false

actor "EV User" as EV
participant "React map UI" as Frontend
participant "nginx-gateway" as Gateway
participant "catalog-service" as Catalog
database "catalog-postgres" as CatalogDb
participant "status-service" as Status
database "status-postgres" as StatusDb
queue "RabbitMQ\nsaasplug.events" as Rabbit

EV -> Frontend : Open /map, pan/zoom, apply filters
Frontend -> Frontend : Derive centerLat, centerLng,\nradiusKm from viewport bounds
Frontend -> Gateway : GET /api/catalog/points?centerLat&centerLng&radiusKm&limit&offset&filters
Gateway -> Catalog : GET /points with same query
Catalog -> CatalogDb : Query catalog_points with filters\nand radius <= 10 km
Catalog -> Rabbit : Best-effort publish usage.search_performed
Catalog --> Gateway : CatalogPointListResponse\nitems, search_circle, bounds_applied
Gateway --> Frontend : Catalog points
Frontend -> Gateway : POST /api/status/cache/statuses\nvisible point keys
Gateway -> Status : POST /cache/statuses
Status -> StatusDb : Read status_cache only
Status --> Gateway : StatusBatchLookupResponse\ncached values and misses
Gateway --> Frontend : Cached status overlay
Frontend --> EV : Render map markers and list

alt User opens quick view or detail
  Frontend -> Gateway : POST /api/catalog/points/{provider}/{externalId}/views
  Gateway -> Catalog : POST /points/{provider}/{externalId}/views
  Catalog -> CatalogDb : Increment/read point view context
  Catalog -> Rabbit : Best-effort publish usage.point_viewed
  Catalog --> Frontend : CatalogPointDetailResponse or 204
end

note right of Frontend
The frontend never calls provider adapters directly.
All browser API traffic starts with /api/ and passes through nginx-gateway.
end note
@enduml
```

## 12. Sequence Diagram - Status Lookup

Source: `sequence-status-lookup.puml`

```plantuml
@startuml
title Status lookup cache hit, live refresh, and fallback sequence
skinparam shadowing false

actor "EV User or frontend view" as User
participant "React frontend" as Frontend
participant "nginx-gateway" as Gateway
participant "status-service" as Status
database "status-postgres" as StatusDb
participant "provider adapter service\nred, green, blue" as ProviderAdapter
participant "provider database\nmatching provider DB" as ProviderDb
participant "External provider API" as ExternalApi
participant "RabbitMQ\nsaasplug.events" as Rabbit

User -> Frontend : Request current point status
Frontend -> Gateway : GET /api/status/points/{provider}/{externalId}/status?forceRefresh=false
Gateway -> Status : GET /points/{provider}/{externalId}/status
Status -> StatusDb : Read status_cache and status_cache_policy

alt Fresh cache and no force refresh
  Status -> StatusDb : Append status_check_logs
  Status -> Rabbit : Best-effort publish status.point_checked\ncache_hit=true
  Status --> Gateway : StatusLookupResponse source=cache
else Cache miss, expired, or force refresh
  Status -> Status : Acquire per-point in-process lock\nand recheck cache
  Status -> ProviderAdapter : GET /internal/points/{externalId}/status
  ProviderAdapter -> ExternalApi : Provider-specific detail/status call
  ExternalApi --> ProviderAdapter : Provider JSON payload
  ProviderAdapter -> ProviderDb : Store raw payload and upsert snapshot
  ProviderAdapter --> Status : ProviderStatusDTO
  Status -> StatusDb : Upsert status_cache\nappend status_check_logs
  Status -> Rabbit : Best-effort publish status.point_checked\nsource=provider_live
  Status --> Gateway : StatusLookupResponse source=provider_live
else Provider error with stale cache
  ProviderAdapter --> Status : Error/timeout
  Status -> StatusDb : Record provider error and append log
  Status -> Rabbit : Best-effort publish status.point_checked\nsource=cache_fallback
  Status --> Gateway : Stale StatusLookupResponse with warning
else Provider error and no cache
  ProviderAdapter --> Status : Error/timeout
  Status -> StatusDb : Append failed status_check_logs
  Status -> Rabbit : Best-effort publish status.point_checked\nerror metadata
  Status --> Gateway : 502/504 lookup error
end

Gateway --> Frontend : Status or error
Frontend --> User : Display status, warning, or retry option
@enduml
```

## 13. Sequence Diagram - Reservation

Source: `sequence-reservation.puml`

```plantuml
@startuml
title Reservation creation, idempotency, provider mutation, and event outbox
skinparam shadowing false

actor "EV User" as EV
participant "React frontend" as Frontend
participant "nginx-gateway" as Gateway
participant "reservation-service" as Reservation
participant "reservation-postgres" as ReservationDb
participant "catalog-service" as Catalog
participant "catalog-postgres" as CatalogDb
participant "provider adapter service" as ProviderAdapter
participant "External provider API" as ExternalApi
participant "status-service" as Status
participant "status-postgres" as StatusDb
participant "scheduler-service or operator" as Scheduler
participant "RabbitMQ\nsaasplug.events" as Rabbit

EV -> Frontend : Reserve selected point for duration
Frontend -> Gateway : POST /api/reservations/points/{provider}/{externalId}/reservations\nIdempotency-Key, duration_minutes
Gateway -> Reservation : POST /points/{provider}/{externalId}/reservations
Reservation -> ReservationDb : Read/create reservation_idempotency_records

alt Duplicate completed idempotency key
  Reservation -> ReservationDb : Load stored reservation/result
  Reservation --> Gateway : Previous ReservationResponse
else New or in-progress key
  Reservation -> Catalog : GET /points/{provider}/{externalId}
  Catalog -> CatalogDb : Read catalog_points
  Catalog --> Reservation : CatalogPointDTO
  Reservation -> ReservationDb : Acquire reservation_point_locks\ncheck active succeeded reservations
  alt Local conflict
    Reservation -> ReservationDb : Store rejected attempt/result
    Reservation --> Gateway : 409 conflict
  else No local conflict
    Reservation -> ProviderAdapter : POST /internal/points/{externalId}/reservations\n{duration_minutes}
    ProviderAdapter -> ExternalApi : Provider-specific reserve/hold call
    ExternalApi --> ProviderAdapter : Reservation response or error
    ProviderAdapter --> Reservation : NormalizedReservationResponse or error

    alt Future reservation end returned
      Reservation -> ReservationDb : Insert succeeded reservations\nand reservation_attempts
      Reservation -> ReservationDb : Stage reservation.succeeded\nin reservation_event_outbox
      Reservation -> Status : POST /internal/cache/seed\nreserved status
      Status -> StatusDb : Upsert status_cache
      Reservation --> Gateway : 201 ReservationResponse succeeded
    else Provider success but missing/past expiry
      Reservation -> ReservationDb : Insert unknown reservation\nwith reconciliation_required=true
      Reservation --> Gateway : Unknown outcome response/error
    else Provider failure or timeout
      Reservation -> ReservationDb : Insert failed or unknown reservation\nand reservation_attempts
      Reservation -> ReservationDb : Stage reservation.failed when applicable
      Reservation --> Gateway : Failure/unknown outcome
    end
  end
end

Gateway --> Frontend : Reservation outcome
Frontend --> EV : Show success, failure, or reconciliation message

Scheduler -> Gateway : POST /api/reservations/internal/jobs/outbox/publish-pending\nblocked at gateway
note right of Scheduler
Scheduler uses Docker-internal service URL instead of gateway for this job.
end note
Scheduler -> Reservation : POST /internal/jobs/outbox/publish-pending\nX-Scheduler-Token
Reservation -> ReservationDb : Select pending reservation_event_outbox rows
Reservation -> Rabbit : Publish reservation.succeeded / reservation.failed
Reservation -> ReservationDb : Mark outbox rows published or failed
@enduml
```

## 14. Sequence Diagram - Provider Sync And Catalog Import

Source: `sequence-provider-sync-catalog-import.puml`

```plantuml
@startuml
title Provider adapter sync and catalog import sequence
skinparam shadowing false

actor "Operator" as Operator
participant "React operator UI" as Frontend
participant "nginx-gateway" as Gateway
participant "scheduler-service" as Scheduler
participant "catalog-service" as Catalog
participant "catalog-postgres" as CatalogDb
participant "provider adapter service\nred, green, blue" as ProviderAdapter
participant "provider database\nmatching provider DB" as ProviderDb
participant "External provider API" as ExternalApi
participant "status-service" as Status
participant "status-postgres" as StatusDb
participant "RabbitMQ\nsaasplug.events" as Rabbit

Operator -> Frontend : Run sync for all providers or one provider
Frontend -> Gateway : POST /api/scheduler/jobs/catalog.import.* /run\nor POST /api/catalog/imports/*

alt Scheduler-triggered run
  Gateway -> Scheduler : POST /jobs/{job_key}/run
  Scheduler -> Catalog : POST /internal/jobs/catalog/imports/all\nor /providers/{provider}\nX-Scheduler-Token, X-Job-Run-Id
else Direct operator import
  Gateway -> Catalog : POST /imports/all or /imports/providers/{provider}
end

Catalog -> CatalogDb : Insert catalog_import_runs\nand acquire catalog_import_locks
Catalog -> ProviderAdapter : POST /internal/sync
ProviderAdapter -> ExternalApi : GET list endpoint\n/points, /chargingPoints, or /locations
ExternalApi --> ProviderAdapter : Provider JSON array
ProviderAdapter -> ProviderDb : Store raw_provider_payloads
ProviderAdapter -> ProviderDb : Upsert provider_point_snapshots\nrecord provider_point_changes
ProviderAdapter -> ProviderDb : Complete provider_sync_runs
ProviderAdapter --> Catalog : SyncSummaryResponse
Catalog -> ProviderAdapter : GET /internal/points
ProviderAdapter -> ProviderDb : Read active normalized snapshots
ProviderAdapter --> Catalog : ProviderPointDTO list
Catalog -> CatalogDb : Upsert catalog_points\nrecord catalog_point_changes\nmark missing points stale
Catalog -> Status : POST /internal/cache/seed\nX-Scheduler-Token
Status -> StatusDb : Upsert status_cache
Catalog -> CatalogDb : Complete catalog_import_runs\nrelease catalog_import_locks
Catalog -> Rabbit : Best-effort publish catalog.points.imported
Catalog --> Scheduler : ImportSummaryResponse
Scheduler --> Gateway : JobRunResponse
Gateway --> Frontend : Run status and summary

note right of ProviderAdapter
Provider adapters call external APIs and persist provider-local snapshots.
They do not actively publish provider snapshot RabbitMQ events in the current implementation.
end note
@enduml
```

## 15. Sequence Diagram - Analytics And Billing Events

Source: `sequence-analytics-billing-events.puml`

```plantuml
@startuml
title Analytics and billing event propagation sequence
skinparam shadowing false

participant "catalog-service" as Catalog
participant "status-service" as Status
participant "reservation-service" as Reservation
participant "reservation-postgres\nreservation_event_outbox" as ReservationDb
participant "billing-service" as Billing
participant "billing-postgres\nbilling_events, charges, outbox" as BillingDb
participant "scheduler-service or operator" as Scheduler
participant "RabbitMQ\nexchange saasplug.events" as Rabbit
participant "analytics-service" as Analytics
participant "analytics-postgres" as AnalyticsDb

Catalog -> Rabbit : Publish usage.search_performed\nusage.point_viewed\ncatalog.points.imported
Status -> Rabbit : Publish status.point_checked

Reservation -> ReservationDb : Stage reservation.succeeded\nor reservation.failed
Scheduler -> Reservation : POST /internal/jobs/outbox/publish-pending
Reservation -> ReservationDb : Read pending reservation_event_outbox rows
Reservation -> Rabbit : Publish reservation.succeeded / reservation.failed
Reservation -> ReservationDb : Mark reservation outbox rows published

Rabbit -> Billing : Deliver billing.reservations queue\nreservation.*, usage.point_viewed
Scheduler -> Billing : POST /internal/jobs/events/drain
Billing -> Rabbit : Consume bounded billing.reservations batch
Billing -> BillingDb : Insert billing_events idempotently
alt Billable event
  Billing -> BillingDb : Create charge_records
  Billing -> BillingDb : Stage billing.charge_created\nin billing_event_outbox
else Not billable by current pricing rule
  Billing -> BillingDb : Mark event skipped
end

Scheduler -> Billing : POST /internal/jobs/outbox/publish-pending
Billing -> BillingDb : Read pending billing_event_outbox rows
Billing -> Rabbit : Publish billing.charge_created\nbilling.invoice_issued\nbilling.invoice_paid
Billing -> BillingDb : Mark billing outbox rows published

Rabbit -> Analytics : Deliver analytics.events queue\nusage.*, status, reservation.*, catalog import, billing.*
Scheduler -> Analytics : POST /internal/jobs/events/consume
Analytics -> Rabbit : Consume bounded analytics.events batch
Analytics -> AnalyticsDb : Insert usage_events,\ncatalog_health_snapshots,\nbilling_summary_snapshots
Scheduler -> Analytics : POST /internal/jobs/aggregates/refresh
Analytics -> AnalyticsDb : Refresh provider, point, operator,\nstatus, and EV reservation aggregates

note over Rabbit
Bindings are declared by packages/events:
analytics.events receives usage.*, status.point_checked, reservation.*,
catalog.points.imported, billing.charge_created, and billing.invoice.*.
billing.reservations receives reservation.succeeded, reservation.failed,
and usage.point_viewed.
end note
@enduml
```
