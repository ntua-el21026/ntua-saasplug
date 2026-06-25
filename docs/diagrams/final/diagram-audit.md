# Final UML Diagram Audit and Correction

Date: 2026-06-25

This audit records the final code-derived correction pass for the saasPlug UML
model. The repository implementation is the source of truth for final diagram
content; earlier SRS draft diagrams and intermediate PlantUML files are treated
as historical context only.

## 1. Assignment-Required Diagram Checklist

| Requirement | Final artifact |
|---|---|
| Use case diagram | `use-case.puml` |
| Activity diagrams | `activity-search-reservation.puml`, `activity-provider-sync.puml`, `activity-invoice-payment.puml` |
| Class diagram for exchanged data structures | `class-data-structures.puml` |
| Class diagram for service APIs | `class-service-apis.puml` |
| Data design / persistence model | `data-model.puml` |
| Component diagram with source-code traceability | `component.puml` |
| Deployment diagram with Docker containers and ports | `deployment.puml` |
| Sequence diagrams | `sequence-login.puml`, `sequence-search-map.puml`, `sequence-status-lookup.puml`, `sequence-reservation.puml`, `sequence-provider-sync-catalog-import.puml`, `sequence-analytics-billing-events.puml` |
| Single markup organizer for PlantUML diagrams | `saasplug-final-uml.md` |
| Audit and correction notes | `diagram-audit.md` |

## 2. Current Final Diagram Inventory

The final diagram directory now contains the complete required set:

- `use-case.puml`
- `activity-search-reservation.puml`
- `activity-provider-sync.puml`
- `activity-invoice-payment.puml`
- `component.puml`
- `deployment.puml`
- `data-model.puml`
- `class-data-structures.puml`
- `class-service-apis.puml`
- `sequence-login.puml`
- `sequence-search-map.puml`
- `sequence-status-lookup.puml`
- `sequence-reservation.puml`
- `sequence-provider-sync-catalog-import.puml`
- `sequence-analytics-billing-events.puml`
- `saasplug-final-uml.md`
- `diagram-audit.md`

## 3. Source Materials Inspected

- Assignment PDFs and provider API PDFs under `docs/assignment/`.
- Provider OpenAPI YAML under `docs/assignment/providers/yaml/`.
- The SRS document and Visual Paradigm file under `docs/assignment/`.
- Lecture material relevant to SOA, microservices, messaging, API gateways,
  Docker deployment, and data-layer ownership under `docs/lectures/`.
- Canonical project docs: `README.md`, `docs/specs/SPECIFICATIONS.md`,
  `docs/architecture-summary.md`, `docs/submission-checklist.md`, and
  `docs/final-verification.md`.
- Runtime configuration: `docker-compose.yml`,
  `deploy/nginx/default.conf`, frontend routing/API helpers, backend route
  modules, SQLAlchemy models, Pydantic schemas, scheduler jobs, and
  `packages/events/`.

The Visual Paradigm source was inspected as SQLite metadata. Its diagram names
were recoverable, but no rendered layout was available from the local tooling.

## 4. Code-Derived Component Inventory

| Component | Source path | Runtime role |
|---|---|---|
| React frontend | `apps/frontend/` | Role-based browser app for EV users, provider admins, and operators |
| Nginx gateway | `deploy/nginx/default.conf` | Public entrypoint, path routing, internal-prefix blocking |
| `auth-service` | `services/auth-service/` | Local auth, refresh tokens, Google OAuth state and PKCE |
| `provider-registry-service` | `services/provider-registry-service/` | Provider metadata and audit logs |
| `red-provider-service` | `services/red-provider-service/` | Internal adapter for redPlug API |
| `green-provider-service` | `services/green-provider-service/` | Internal adapter for greenPlug API |
| `blue-provider-service` | `services/blue-provider-service/` | Internal adapter for bluePlug API |
| `catalog-service` | `services/catalog-service/` | Search, point detail, imports, catalog freshness |
| `status-service` | `services/status-service/` | Status cache, live lookup, fallback, freshness |
| `reservation-service` | `services/reservation-service/` | Reservation mutation, idempotency, point lock, outbox |
| `analytics-service` | `services/analytics-service/` | Event ingestion, aggregate refresh, dashboards, CSV export |
| `billing-service` | `services/billing-service/` | Event drain, charges, invoices, payments, billing outbox |
| `scheduler-service` | `services/scheduler-service/` | Operator-controlled job metadata and internal job execution |
| Event package | `packages/events/` | Shared event envelope, topology, publishers, consumers |

## 5. Docker, Container, and Port Inventory

| Container | Image/build | Public exposure | Internal port / persistence |
|---|---|---|---|
| `nginx-gateway` | `nginx:1.27-alpine` | Host HTTP port `8080` by default to container `80` | Routes to Docker services |
| `frontend` | `apps/frontend` multi-stage build, runtime Nginx | Not directly published | Internal `5173`, static built React assets |
| Backend services | Service Dockerfiles | Not directly published | Internal `8000` |
| PostgreSQL containers | `postgres:16-alpine` | Not published | Internal `5432`, one named volume per service |
| `rabbitmq` | `rabbitmq:3-management` | Management UI bound to localhost `15672` by default | AMQP `5672` internal, `rabbitmq-data` volume |

## 6. Gateway Route Inventory

| Public prefix | Target service |
|---|---|
| `/` | `frontend:5173` |
| `/api/auth/` | `auth-service:8000`, rewritten to `/auth/*` |
| `/api/providers/` and `/api/provider-registry/` | `provider-registry-service:8000` |
| `/api/catalog/` | `catalog-service:8000` |
| `/api/status/` | `status-service:8000` |
| `/api/reservations/` | `reservation-service:8000` |
| `/api/analytics/` | `analytics-service:8000` |
| `/api/billing/` | `billing-service:8000` |
| `/api/scheduler/` | `scheduler-service:8000` |

Gateway blocks service-owned internal job prefixes for catalog, reservations,
analytics, and billing. Provider adapter services are not exposed through the
gateway.

## 7. Backend Route Inventory

| Service | Route groups represented in final API diagram |
|---|---|
| `auth-service` | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/password`, `/auth/me`, Google login/callback |
| `provider-registry-service` | Provider list/detail/create/patch/status, integration config, audit logs |
| Provider adapters | `/internal/provider`, `/internal/points`, `/internal/sync`, `/internal/points/{id}`, `/internal/points/{id}/status`, `/internal/points/{id}/reservations`, `/internal/sync-runs` |
| `catalog-service` | `/points`, `/points/{provider}/{id}`, `/points/{provider}/{id}/views`, `/imports/*`, `/freshness`, internal catalog import jobs |
| `status-service` | `/cache/statuses`, `/points/statuses`, `/points/{provider}/{id}/status`, `/cache/{provider}/{id}`, `/cache/policy`, `/logs`, `/freshness`, `/internal/cache/seed` |
| `reservation-service` | EV reservation creation, own/admin reservation reads, attempts, outbox listing/publish, internal outbox job |
| `analytics-service` | Event ingest/consume, aggregate refresh, provider/operator/EV analytics, CSV export, internal jobs |
| `billing-service` | Event ingest/drain, outbox publishing, pricing, charges, invoice issue/list/detail/pay, overview, internal jobs |
| `scheduler-service` | Jobs, interval presets, patch/pause/resume/manual run, ordered maintenance run, run history, health |

## 8. Database and Table Inventory

| Database | Tables represented |
|---|---|
| `auth-postgres` | `users`, `refresh_tokens`, `oauth_states` |
| `provider-registry-postgres` | `providers`, `provider_config_audit_logs` |
| Provider DBs | `provider_point_snapshots`, `raw_provider_payloads`, `provider_sync_runs`, `provider_point_changes` |
| `catalog-postgres` | `catalog_points`, `catalog_import_runs`, `catalog_import_locks`, `catalog_point_changes` |
| `status-postgres` | `status_cache`, `status_cache_policy`, `status_check_logs` |
| `reservation-postgres` | `reservations`, `reservation_attempts`, `reservation_idempotency_records`, `reservation_point_locks`, `reservation_event_outbox` |
| `analytics-postgres` | `usage_events`, provider/point/operator/status/EV reservation metrics, `catalog_health_snapshots`, `billing_summary_snapshots`, `export_jobs` |
| `billing-postgres` | `pricing_rules`, `billing_events`, `charge_records`, `invoices`, `invoice_lines`, `payments`, `billing_event_outbox` |
| `scheduler-postgres` | `scheduled_jobs`, `job_runs` |

The data model treats cross-service relationships as logical data-flow links,
not cross-database foreign keys.

## 9. DTO and Schema Inventory

| Domain | Representative DTO/schema classes represented |
|---|---|
| Auth | `RegisterRequest`, `LoginRequest`, `AuthTokenResponse`, `UserResponse`, role enum |
| Provider registry | `ProviderCreateRequest`, `ProviderUpdateRequest`, `ProviderResponse`, `ProviderIntegrationConfigResponse` |
| Provider adapters | `ProviderIdentityResponse`, `NormalizedPointResponse`, `StatusResponse`, `ReservationRequest`, `NormalizedReservationResponse`, `SyncSummaryResponse` |
| Catalog/status | `CatalogPointResponse`, `CatalogPointListResponse`, `CatalogSearchCircleResponse`, `PointViewRequest`, `StatusBatchLookupRequest`, `StatusLookupResponse`, `StatusCachePolicyResponse` |
| Reservation | `ReservationCreateRequest`, `ReservationResponse`, `ReservationAttemptResponse`, `OutboxPublishResponse` |
| Billing/analytics/scheduler | Pricing, charge, invoice, analytics summary, scheduler job, and job run responses |
| Events | `EventEnvelope` and the implemented event type set |

## 10. RabbitMQ Inventory

| Element | Implemented value |
|---|---|
| Main exchange | `saasplug.events` |
| Dead-letter exchange | `saasplug.events.dlx` |
| Analytics queue | `analytics.events`, receives usage, status, reservation, catalog import, and billing events |
| Billing queue | `billing.reservations`, receives reservation success/failure and point-view events |
| Catalog snapshot queue | `catalog.provider_snapshots`, declared for provider snapshot events but not active in the current provider adapter runtime |
| Live direct publishers | `catalog-service` and `status-service` |
| Outbox-backed publishers | `reservation-service` and `billing-service` |
| Consumers | `analytics-service` and `billing-service` during explicit drains/jobs |

## 11. Scheduler Job Inventory

The default scheduler jobs represented in the diagrams are:

- `catalog.import.all`
- `analytics.consume-events`
- `analytics.refresh-aggregates`
- `billing.drain-events`
- `billing.publish-outbox`
- `reservation.publish-outbox`
- `billing.prepare-invoices`
- Manual provider imports for `redPlug`, `greenPlug`, and `bluePlug`
- Manual analytics refresh and billing drain jobs

The ordered maintenance action runs catalog import, reservation outbox publish,
billing drain, billing outbox publish, analytics consume, and analytics refresh
in dependency order.

## 12. Naming Dictionary

| Concept | Final diagram name |
|---|---|
| Product | `saasPlug` |
| EV role | `EV User` / `EV_USER` |
| Provider admin role | `Provider Admin` / `PROVIDER_ADMIN` |
| Operator role | `Operator` / `OPERATOR` |
| Provider codes | `redPlug`, `greenPlug`, `bluePlug` |
| Gateway | `nginx-gateway` |
| Frontend | `frontend` / `apps/frontend` |
| Provider adapters | `red-provider-service`, `green-provider-service`, `blue-provider-service` |
| Status field | `status` |
| Search geometry used by frontend | `centerLat`, `centerLng`, `radiusKm` |
| Event exchange | `saasplug.events` |

## 13. Found Inconsistencies and Corrections Applied

| Finding | Correction |
|---|---|
| Some draft diagrams described map search as bounds-based. | Final search diagrams now show viewport-derived circle search with `centerLat`, `centerLng`, and `radiusKm`; the backend still supports bounds, but the frontend sends radius search. |
| Draft provider-sync diagrams implied provider services publish RabbitMQ snapshot events. | Final component, activity, and sequence diagrams show provider adapters as internal HTTP adapters only. RabbitMQ provider snapshot topology is documented as declared but not active. |
| Event flow arrows showed consumers actively pulling from RabbitMQ without distinguishing delivery/drain semantics. | Final diagrams show RabbitMQ queues and scheduled/operator drains explicitly, including reservation and billing outboxes. |
| Deployment wording could be read as a development frontend server. | Final deployment diagram states the frontend container serves static built React assets through Nginx on internal port `5173`. |
| Final diagram set lacked separate class diagrams for exchanged data structures and service APIs. | Added `class-data-structures.puml` and `class-service-apis.puml`. |
| Persistence diagrams did not explicitly include several implemented state tables. | Final data model includes `oauth_states`, `status_cache_policy`, catalog import locks, reservation idempotency and point locks, analytics health/summary snapshots, and billing outbox state. |
| PlantUML files were not organized through a single final markup file. | Added `saasplug-final-uml.md` with a complete index and embedded PlantUML source blocks. |

## 14. Exact Correction Set Applied

- Replaced all existing final PlantUML diagrams with code-derived versions.
- Added the two missing class diagrams required by the assignment.
- Added `saasplug-final-uml.md` as the single final UML markup organizer.
- Added this audit file with source inventories, naming dictionary, and
  correction log.
- Updated supporting final documentation to reference the complete final set.
