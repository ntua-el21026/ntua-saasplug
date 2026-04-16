# saasPlug UML Architecture and Diagram Specification

Status: implemented in `docs/diagrams/intermediate/saasplug_uml_model.md`

This document records the decisions that affect the first assignment deliverable: one PlantUML-based UML model containing use case, activity, class, component, deployment, sequence, and data design diagrams. It is the working specification for the final PlantUML markup file that will be created under `docs/diagrams/intermediate/`.

## Reviewed Inputs

- `docs/assignment/Εκφώνηση Εξαμηνιαίας Εργασίας.pdf`
- `docs/assignment/SRS Εξαμηνιαίας Εργασίας.docx`
- `docs/assignment/Διαγράμματα SRS.vpp`
- `docs/assignment/plantUML_diagrams/*.puml`
- `docs/assignment/providers/yaml/*.yaml`
- `docs/assignment/providers/postman_collections/*.json`
- `docs/assignment/providers/swagger_apis_hypothetical_providers.md`
- `docs/assignment/Project Notes from Lectures.docx`
- `docs/lectures/`, excluding `docs/lectures/bibliography/`

## Impact of Project Notes from Lectures

The professor notes materially affect the first UML model decisions:

- Keep the API Gateway / reverse proxy idea. Frontend should not expose direct backend/provider URLs or raw service ports.
- Messaging is useful, but not for everything. We should not put outgoing external provider calls behind a queue just because we can.
- Do not queue the user reservation command before calling the provider. The EV user needs an immediate accepted/rejected result from the provider.
- Use messaging mainly for synchronization between our own services/data stores.
- Keep a local saasPlug charging point catalog/cache. Without it, every user map/search would require many calls to provider APIs.
- Minimize provider calls:
  - periodic provider catalog/list calls, e.g. nightly or scheduled;
  - on-demand status calls when fresh status is needed;
  - on-demand reservation calls when the EV user requests a reservation.
- Model click/search/reservation logs explicitly because analytics and billing depend on them.
- Model at least these data stores: charging point catalog, click/search usage log, reservations, analytics/billing data.

## Deliverable Format Decision

- Use PlantUML.
- All final diagrams must be organized in one Markdown file under `docs/diagrams/intermediate/`.
- Keep this file as the decision/specification input; do not treat it as the final UML deliverable.

## Canonical Names

Use these names exactly across diagrams unless this file is updated.

### Actors

- `Χρήστης EV`
- `Charging points provider`
- `saasPlug operator`
- `External Payment Gateway`
- `Google OAuth Provider`
- `redPlug API`
- `greenPlug API`
- `bluePlug API`

### Use Cases

- `Search for a point`
- `Login with Google`
- `Reservation`
- `Register to saasCharge`
- `View own analytics`
- `View invoice`
- `Pay invoice`
- `Export own logs`
- `View global analytics`

### Runtime Components / Services

- `Web Frontend`
- `API Gateway`
- `Identity & Access Service`
- `Provider Registry Service`
- `Charging Point Catalog Service`
- `Provider Sync Service`
- `Charging Point Status Service`
- `Reservation Service`
- `Usage & Analytics Service`
- `Billing & Payment Service`
- `Provider Client Library`
- `RabbitMQ Message Broker`
- `PostgreSQL`

### Provider Adapters

These are components inside `Provider Client Library`, not separate Docker containers in the first target architecture.

- `redPlug Adapter`
- `greenPlug Adapter`
- `bluePlug Adapter`

### Events

- `ProviderCatalogSyncRequested`
- `ProviderCatalogFetched`
- `ChargingPointCatalogUpdated`
- `ProviderStatusUpdated`
- `PointViewed`
- `SearchPerformed`
- `ReservationConfirmed`
- `ReservationRejected`
- `InvoiceIssued`
- `InvoicePaid`

Do not use an event named `ReservationRequested` for the user reservation command path. Reservation command handling is synchronous.

## Architecture Decisions

### ADR-001: Use Business-Capability Microservices

Status: accepted for UML draft

Decision:

The UML target architecture uses business-capability services, not one monolithic backend.

Services:

- `Identity & Access Service`: users, roles, Google OAuth/JWT session handling.
- `Provider Registry Service`: provider registration and provider API configuration.
- `Charging Point Catalog Service`: local searchable charging point catalog/cache used by map/search.
- `Provider Sync Service`: scheduled provider list/catalog ingestion with retries.
- `Charging Point Status Service`: fresh status refreshes through provider status APIs.
- `Reservation Service`: reservation command flow and provider reservation calls.
- `Usage & Analytics Service`: search/click/reservation usage logs, analytics, exports.
- `Billing & Payment Service`: invoices, invoice lines, provider payment state.

Rationale:

- It satisfies the mandatory microservices architecture.
- It follows the professor notes by separating catalog sync, status checks, reservation commands, analytics, and billing.
- It keeps provider API heterogeneity behind adapters.

### ADR-002: Use API Gateway / Reverse Proxy

Status: accepted for UML draft

Decision:

All browser-facing calls go through `API Gateway`. Backend services are private Docker-network services.

Implementation target:

- Use Nginx or Apache as a simple reverse proxy in the course project.
- Keep the model generic enough that Kong or Apache APISIX could replace it later.

Public route map:

| Public route | Target |
| --- | --- |
| `/` | `Web Frontend` |
| `/api/auth/*` | `Identity & Access Service` |
| `/api/providers/*` | `Provider Registry Service` |
| `/api/charging-points/*` | `Charging Point Catalog Service` |
| `/api/status/*` | `Charging Point Status Service` |
| `/api/reservations/*` | `Reservation Service` |
| `/api/analytics/*` | `Usage & Analytics Service` |
| `/api/billing/*` | `Billing & Payment Service` |

Diagram impact:

- Sequence diagrams show `Web Frontend -> API Gateway -> service`.
- Deployment diagram exposes only gateway port publicly, except explicitly marked dev-only ports.

### ADR-003: Use Messaging for Internal Synchronization, Not Provider Commands

Status: accepted for UML draft

Decision:

Use `RabbitMQ Message Broker` for internal event propagation and database synchronization. Do not use RabbitMQ as a queue in front of external provider status/reservation calls.

Use RabbitMQ for:

- provider catalog synchronization;
- status update fan-out;
- search/click/reservation logs for analytics;
- reservation success/failure propagation to analytics and billing;
- invoice payment events.

Do not use RabbitMQ for:

- synchronous EV reservation command before the provider call;
- direct external provider API calls;
- hiding slow provider status calls behind an async command where the user expects immediate status.

Rationale:

- The notes explicitly point to messaging as useful for database synchronization.
- The user-facing reservation flow needs direct provider confirmation.

### ADR-004: Keep a Local Charging Point Catalog

Status: accepted for UML draft

Decision:

`Charging Point Catalog Service` owns a local normalized catalog of charging points. Search and map views use this local catalog instead of calling every provider on every search.

Update policy:

- `Provider Sync Service` periodically calls provider list endpoints.
- Default schedule in diagrams: nightly catalog sync.
- It retries failed provider calls.
- It normalizes each provider response and publishes `ProviderCatalogFetched`.
- `Charging Point Catalog Service` consumes `ProviderCatalogFetched`, computes diffs against `catalog_db`, persists new/changed points, and publishes `ChargingPointCatalogUpdated`.

Chosen sync policy:

- Use a diff-based update policy for diagrams: compare the fetched provider response with the known catalog and persist changes inside `Charging Point Catalog Service`.
- Mention full replacement as an implementation alternative, not the modeled default.

Rationale:

- This minimizes external provider calls.
- It supports search/map responsiveness.
- It creates a clear data store for the data design diagram.

### ADR-005: Keep Status Refresh and Reservation as Separate Services

Status: accepted for UML draft

Decision:

Separate:

- `Charging Point Status Service`: gets fresh charger status through provider APIs.
- `Reservation Service`: reserves/holds a charger through provider APIs.

Rationale:

- The professor notes call out status requests and reservation requests as two important call paths.
- Reservation is monetized and must be auditable.
- Status refresh can be cached and synchronized without coupling it to reservation command handling.

### ADR-006: Normalize Provider APIs at the Boundary

Status: accepted for UML draft

Decision:

Keep provider-specific DTOs at the boundary, then convert them into normalized saasPlug DTOs.

Provider field mapping:

| Concept | redPlug | greenPlug | bluePlug | Internal DTO |
| --- | --- | --- | --- | --- |
| Provider name | `providerName` | `providerName` | `providerName` | `providerName` |
| External point id | `pointid` | `id` | `chargerId` | `externalPointId` |
| Status | `status` | `state` | `currentStatus` | `status` |
| Reservation end | `reservationendtime` | `reservedUntil` | `reservationEnd` | `reservationEndsAt` |
| Price | absent in `RedPoint` | `kwhRateEur` | `pricePerKwh` | `pricePerKwh` |
| Capacity | `cap` | `cap` | `cap` | `capacityKw` |
| Connector | `connector` | `connector` | `connector` | `connectorType` |
| Location name | `locationName` | `locationName` | `locationName` | `locationName` |
| Address | `address` | `address` | `address` | `address` |

If coordinates are unavailable from providers, keep `latitude` and `longitude` nullable in the internal model and use `address`/`locationName` as fallback location data.

### ADR-007: Use Database-Per-Service Ownership

Status: accepted for UML draft

Decision:

Each microservice owns its own database or schema and is the only service allowed to read/write it directly.

For Docker simplicity, the deployment diagram may show one `postgres` container. Inside that container, the model must still show separate service-owned databases/schemas with separate credentials:

- `identity_db`
- `providers_db`
- `provider_sync_db`
- `catalog_db`
- `status_db`
- `reservations_db`
- `usage_analytics_db`
- `billing_db`

Data needed by multiple services is duplicated as local snapshots/read models, not shared through cross-service SQL joins. Synchronization happens through service APIs and RabbitMQ events.

Rationale:

- This follows the microservice database-per-service principle.
- It also follows the professor notes: messaging is mainly useful for synchronizing data between service-owned stores.
- It keeps Docker Compose manageable while still modeling independent data ownership.
- It makes overlap explicit: `providerId`, `pointId`, `reservationId`, and selected provider/point/reservation snapshots can appear in more than one service database.

### ADR-008: Use JWT Roles

Status: accepted for UML draft

Decision:

`Identity & Access Service` issues JWTs with roles.

Roles:

- `EV_USER`
- `PROVIDER_ADMIN`
- `SAASPLUG_OPERATOR`

Access policy:

| Actor | Role | Main permissions |
| --- | --- | --- |
| `Χρήστης EV` | `EV_USER` | search charging points, view point details/status, request reservations |
| `Charging points provider` | `PROVIDER_ADMIN` | register provider, view own analytics, view/pay invoices, export own logs |
| `saasPlug operator` | `SAASPLUG_OPERATOR` | view global analytics |

Model decision:

- Keep Google OAuth in the UML model because it appears in the assignment statement.
- `Search for a point` can be anonymous or authenticated. `Reservation` requires `EV_USER`.

### ADR-009: Billing Follows Confirmed Reservations

Status: accepted for UML draft

Decision:

Billing is triggered only after provider-confirmed reservations.

Flow:

1. `Reservation Service` calls the provider reservation endpoint synchronously.
2. If the provider confirms, `Reservation Service` stores a confirmed reservation.
3. `Reservation Service` publishes `ReservationConfirmed`.
4. `Billing & Payment Service` consumes `ReservationConfirmed` and creates invoice lines.
5. `Usage & Analytics Service` consumes the same event for analytics.

Rationale:

- The SRS says the provider decides whether the reservation is satisfied.
- The saasPlug provider charge should correspond to successful reservation value.

### ADR-010: Separate Analytics From Billing

Status: accepted for UML draft

Decision:

- `Usage & Analytics Service` owns raw usage events, provider analytics, operator analytics, and export jobs.
- `Billing & Payment Service` owns invoices, invoice lines, and payment state.

Rationale:

- Analytics uses clicks/searches/reservations.
- Billing uses invoiceable events and payments.
- The two services need different APIs and data lifecycles.

### ADR-011: Use Docker Compose in Deployment Diagram

Status: accepted for UML draft

Decision:

The deployment model uses Docker Compose with explicit containers, ports, networks, volumes, and external systems.

Docker networks:

- `public_net`: gateway-facing network.
- `backend_net`: private service-to-service network.
- `data_net`: private database/broker network.

Volumes:

- `postgres_data`: PostgreSQL persistent data.
- `rabbitmq_data`: RabbitMQ persistent broker state.

Secrets/environment:

- Provider API keys are injected as Docker secrets or environment variables and referenced by `Provider Registry Service`/provider clients.
- JWT signing secret is private to `Identity & Access Service`.
- Payment gateway credentials are private to `Billing & Payment Service`.

### ADR-012: Use React TypeScript and FastAPI

Status: proposed implementation target

Decision:

- Frontend: React with TypeScript.
- Backend services: Python FastAPI.
- API documentation: OpenAPI generated by FastAPI.
- Database: PostgreSQL.
- Messaging: RabbitMQ.

Rationale:

- React is allowed by the assignment.
- FastAPI matches the provider API style and OpenAPI tooling.
- TypeScript/FastAPI schemas make DTO consistency easier.

### ADR-013: Component Source References

Status: accepted for UML draft

Decision:

Component diagrams must include GitHub source references, using intended repository paths even before implementation exists.

Repository base:

- `https://github.com/ntua-el21026/saasPlug`

Source references:

| Component | GitHub source reference |
| --- | --- |
| `Web Frontend` | `https://github.com/ntua-el21026/saasPlug/tree/main/apps/frontend` |
| `API Gateway` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/api-gateway` |
| `Identity & Access Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/identity` |
| `Provider Registry Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/provider-registry` |
| `Charging Point Catalog Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/charging-point-catalog` |
| `Provider Sync Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/provider-sync` |
| `Charging Point Status Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/charging-point-status` |
| `Reservation Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/reservations` |
| `Usage & Analytics Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/usage-analytics` |
| `Billing & Payment Service` | `https://github.com/ntua-el21026/saasPlug/tree/main/services/billing-payment` |
| `Provider Client Library` | `https://github.com/ntua-el21026/saasPlug/tree/main/packages/provider-clients` |
| `Docker Compose deployment` | `https://github.com/ntua-el21026/saasPlug/tree/main/deploy` |

## Diagram Decisions Matrix

| Required item | Decision | Status |
| --- | --- | --- |
| Use case diagram | Keep all SRS actors/use cases/extensions, correct the exported `<<extend>>` directions, and add `Login with Google` as the authentication use case. | accepted |
| Activity diagram | Produce four activity diagrams: provider registration, catalog sync, search/status, reservation/billing. | accepted |
| Class diagram - exchanged data | Model provider-specific DTOs and normalized saasPlug DTOs. | accepted |
| Class diagram - APIs | Model service API interfaces with operations, request DTOs, and response DTOs. | accepted |
| Data design | Use ER/class diagram with database-per-service ownership; duplicated cross-service data appears as local snapshots/read models, not shared tables. | accepted |
| Component diagram | Model runtime services, provider client adapters, RabbitMQ, PostgreSQL, payment gateway, provider APIs, GitHub links. | accepted |
| Deployment diagram | Docker Compose, explicit ports, networks, volumes, secrets, external APIs. | accepted |
| Sequence diagrams | Produce eight sequence diagrams: Google login, search, status refresh, reservation, provider registration, provider catalog sync, analytics/export, view/pay invoice. | accepted |
| Consistency | Use canonical names from this file in every diagram. | accepted |

## Use Case Diagram Specification

Actors:

- `Χρήστης EV`
- `Charging points provider`
- `saasPlug operator`
- External actors shown only when useful: `External Payment Gateway`, `Google OAuth Provider`, provider APIs.

Use cases and relations:

- `Χρήστης EV` -> `Search for a point`
- `Χρήστης EV` -> `Login with Google`
- `Reservation` extends `Search for a point`
- `Reservation` requires authenticated `EV_USER`; the diagram may show this as `Reservation` includes `Login with Google` or as a precondition note.
- `Charging points provider` -> `Register to saasCharge`
- `Charging points provider` -> `View own analytics`
- `View invoice` extends `View own analytics`
- `Export own logs` extends `View own analytics`
- `Pay invoice` extends `View invoice`
- `saasPlug operator` -> `View global analytics`

Modeling note:

- Keep the exported SRS use case baseline, but write the `<<extend>>` relationships in standard UML direction: the extending use case points to the base use case.
- Model `Login with Google` because the assignment statement and lectures use Google login in the SaaS examples. Do not add team-size labels to the diagram text.

## Activity Diagram Specifications

### Activity A: Provider Registration

Purpose:

Show how a charging point provider joins saasPlug and how the first catalog synchronization is triggered.

Swimlanes:

- `Charging points provider`
- `Web Frontend`
- `API Gateway`
- `Provider Registry Service`
- `Provider Client Library`
- provider APIs
- `RabbitMQ Message Broker`
- `PostgreSQL`

Steps:

1. Provider signs in as `PROVIDER_ADMIN`.
2. Provider submits `ProviderRegistrationDTO`.
3. Frontend calls `POST /api/providers`.
4. `Provider Registry Service` validates provider type, base URL, contact email, and API key reference.
5. Optionally call a lightweight provider endpoint through `Provider Client Library` to verify credentials.
6. Persist `Provider` and `ProviderCredential` in `providers_db`.
7. Publish `ProviderCatalogSyncRequested` for the newly registered provider.
8. Return `ProviderDTO`.

### Activity B: Provider Catalog Synchronization

Purpose:

Show periodic update of local charging point catalog without calling providers for every user search.

Swimlanes:

- `Scheduler`
- `Provider Sync Service`
- `Provider Registry Service`
- `Provider Client Library`
- `RabbitMQ Message Broker`
- `Charging Point Catalog Service`
- `PostgreSQL`

Steps:

1. Scheduler triggers nightly sync.
2. `Provider Sync Service` selects active providers from `Provider Registry Service` or provider configuration.
3. For each provider, call provider list endpoint through provider adapter.
4. Retry failed provider calls a limited number of times.
5. Normalize provider response to `ProviderCatalogSnapshotDTO`.
6. Publish `ProviderCatalogFetched`.
7. `Charging Point Catalog Service` consumes event.
8. Compute diff against `catalog_db`.
9. Persist new/changed `ChargingPoint` rows.
10. Publish `ChargingPointCatalogUpdated`.
11. Record `ProviderSyncRun`.

### Activity C: Search and Status Refresh

Purpose:

Show user search using local catalog, plus optional fresh status call when details are requested.

Swimlanes:

- `Χρήστης EV`
- `Web Frontend`
- `API Gateway`
- `Charging Point Catalog Service`
- `Charging Point Status Service`
- `Provider Client Library`
- `RabbitMQ Message Broker`
- `Usage & Analytics Service`

Steps:

1. User searches/filter points.
2. Frontend calls `GET /api/charging-points`.
3. Catalog service reads local catalog and latest cached statuses.
4. Publish `SearchPerformed`.
5. User selects a point.
6. Frontend calls `GET /api/status/{pointId}` if fresh status is needed.
7. Status service resolves `ChargingPointDTO` from `Charging Point Catalog Service`.
8. Status service calls provider status API synchronously with `providerId` and `externalPointId`.
9. Normalize response to `ChargingPointStatusDTO`.
10. Publish `ProviderStatusUpdated` and `PointViewed`.
11. Return current status/details to frontend.

### Activity D: Reservation and Billing

Purpose:

Show synchronous provider reservation and asynchronous analytics/billing propagation.

Swimlanes:

- `Χρήστης EV`
- `Web Frontend`
- `API Gateway`
- `Charging Point Catalog Service`
- `Provider Registry Service`
- `Reservation Service`
- `Provider Client Library`
- `RabbitMQ Message Broker`
- `Usage & Analytics Service`
- `Billing & Payment Service`

Steps:

1. User requests reservation.
2. Frontend posts `ReservationRequestDTO`.
3. Reservation service validates JWT role and idempotency key.
4. Reservation service gets `ChargingPointDTO` from `Charging Point Catalog Service`.
5. Reservation service resolves provider configuration through `Provider Registry Service`.
6. Reservation service calls provider reservation API synchronously.
7. If accepted, store `Reservation` as `CONFIRMED`, return `ReservationResultDTO`, publish `ReservationConfirmed`.
8. If rejected, store failed attempt, return `ReservationResultDTO`, publish `ReservationRejected`.
9. Analytics consumes reservation event.
10. Billing consumes `ReservationConfirmed` and creates `InvoiceLine`.

## Sequence Diagram Specifications

Produce these sequence diagrams.

### Sequence 1: Login with Google

Participants:

- `Χρήστης EV`
- `Web Frontend`
- `API Gateway`
- `Identity & Access Service`
- `Google OAuth Provider`
- `PostgreSQL`

Main messages:

- `GET /api/auth/google/start`
- redirect to Google OAuth consent/login
- Google OAuth callback with authorization code
- `completeGoogleOAuth(code): AuthTokenDTO`
- `upsertUser(googleSubject, email, displayName)`
- return JWT `AuthTokenDTO`

### Sequence 2: Search for a Point

Participants:

- `Χρήστης EV`
- `Web Frontend`
- `API Gateway`
- `Charging Point Catalog Service`
- `PostgreSQL`
- `RabbitMQ Message Broker`
- `Usage & Analytics Service`

Main messages:

- `GET /api/charging-points?filters`
- `findChargingPoints(filters): ChargingPointDTO[]`
- `publish(SearchPerformed)`
- `recordUsageEvent(SearchPerformed)`

### Sequence 3: View Fresh Point Status

Participants:

- `Χρήστης EV`
- `Web Frontend`
- `API Gateway`
- `Charging Point Status Service`
- `Charging Point Catalog Service`
- `Provider Client Library`
- one of `redPlug API`, `greenPlug API`, `bluePlug API`
- `RabbitMQ Message Broker`

Main messages:

- `GET /api/status/{pointId}`
- `getPointStatus(pointId): ChargingPointStatusDTO`
- `getChargingPoint(pointId): ChargingPointDTO`
- provider-specific status call
- `publish(ProviderStatusUpdated)`
- catalog updates latest status cache

### Sequence 4: Reservation

Participants:

- `Χρήστης EV`
- `Web Frontend`
- `API Gateway`
- `Reservation Service`
- `Charging Point Catalog Service`
- `Provider Registry Service`
- `Provider Client Library`
- one of `redPlug API`, `greenPlug API`, `bluePlug API`
- `PostgreSQL`
- `RabbitMQ Message Broker`
- `Usage & Analytics Service`
- `Billing & Payment Service`

Main messages:

- `POST /api/reservations`
- `createReservation(ReservationRequestDTO): ReservationResultDTO`
- `getChargingPoint(pointId): ChargingPointDTO`
- `resolveProvider(providerId)`
- provider-specific reserve/hold call
- `saveReservation(status)`
- `publish(ReservationConfirmed | ReservationRejected)`
- analytics and billing consume event

### Sequence 5: Register to saasCharge

Participants:

- `Charging points provider`
- `Web Frontend`
- `API Gateway`
- `Identity & Access Service`
- `Provider Registry Service`
- `Provider Client Library`
- one of `redPlug API`, `greenPlug API`, `bluePlug API`
- `PostgreSQL`
- `RabbitMQ Message Broker`
- `Provider Sync Service`

Main messages:

- provider authenticates as `PROVIDER_ADMIN`
- `POST /api/providers`
- `registerProvider(ProviderRegistrationDTO): ProviderDTO`
- optional provider credential check through provider adapter
- `saveProvider()` and `saveProviderCredential()`
- `publish(ProviderCatalogSyncRequested)`
- provider sync begins initial catalog ingestion asynchronously

### Sequence 6: Provider Catalog Sync

Participants:

- `Scheduler`
- `Provider Sync Service`
- `Provider Registry Service`
- `Provider Client Library`
- provider APIs
- `RabbitMQ Message Broker`
- `Charging Point Catalog Service`
- `PostgreSQL`

Main messages:

- `runScheduledSync()`
- `listActiveProviders()`
- provider-specific list call
- `normalizeCatalog()`
- `publish(ProviderCatalogFetched)`
- `computeCatalogDiff(snapshot)`
- `upsertChargingPoints(diff)`
- `publish(ChargingPointCatalogUpdated)`
- `recordProviderSyncRun()`

### Sequence 7: View Analytics and Export Logs

Participants:

- `Charging points provider`
- `saasPlug operator`
- `Web Frontend`
- `API Gateway`
- `Usage & Analytics Service`
- `PostgreSQL`

Main messages:

- provider calls `GET /api/analytics/provider/me`
- `getProviderAnalytics(AnalyticsQueryDTO): AnalyticsSummaryDTO`
- provider calls `GET /api/analytics/provider/me/export`
- `exportProviderUsageLog(AnalyticsQueryDTO): ExportFileDTO`
- operator calls `GET /api/analytics/operator/global`
- `getGlobalAnalytics(AnalyticsQueryDTO): AnalyticsSummaryDTO`

### Sequence 8: View Invoice and Pay Invoice

Participants:

- `Charging points provider`
- `Web Frontend`
- `API Gateway`
- `Billing & Payment Service`
- `External Payment Gateway`
- `PostgreSQL`
- `RabbitMQ Message Broker`
- `Usage & Analytics Service`

Main messages:

- `GET /api/billing/provider/me/invoices`
- `getProviderInvoices(): InvoiceDTO[]`
- `POST /api/billing/provider/me/invoices/{invoiceId}/pay`
- `createPayment(PaymentDTO)`
- external payment authorization/capture
- `markInvoicePaid()`
- `publish(InvoicePaid)`

## Exchanged Data DTO Specification

Use these DTO classes in the class/data diagram and API operation signatures.

### Normalized DTOs

`AuthTokenDTO`

- `accessToken: string`
- `tokenType: string`
- `expiresAt: datetime`
- `user: UserDTO`

`UserDTO`

- `userId: UUID`
- `email: string`
- `displayName: string`
- `role: string`

`ProviderDTO`

- `providerId: UUID`
- `providerName: string`
- `providerType: ProviderType`
- `apiBaseUrl: string`
- `contactEmail: string`
- `status: string`
- `registeredAt: datetime`

`ChargingPointSearchQueryDTO`

- `providerId: UUID?`
- `connectorType: string?`
- `status: ChargingPointStatus?`
- `minCapacityKw: int?`
- `maxPricePerKwh: decimal?`
- `nearAddress: string?`
- `limit: int`
- `offset: int`

`ChargingPointDTO`

- `pointId: UUID`
- `providerId: UUID`
- `providerName: string`
- `externalPointId: string`
- `locationName: string?`
- `address: string?`
- `latitude: decimal?`
- `longitude: decimal?`
- `connectorType: string?`
- `capacityKw: int`
- `pricePerKwh: decimal?`
- `status: ChargingPointStatus`
- `reservationEndsAt: datetime?`
- `lastStatusUpdatedAt: datetime?`

`ChargingPointStatusDTO`

- `pointId: UUID`
- `providerId: UUID`
- `externalPointId: string`
- `status: ChargingPointStatus`
- `reservationEndsAt: datetime?`
- `pricePerKwh: decimal?`
- `observedAt: datetime`

`ProviderRegistrationDTO`

- `providerName: string`
- `apiBaseUrl: string`
- `apiKey: string`
- `providerType: ProviderType`
- `contactEmail: string`

`ProviderCatalogSnapshotDTO`

- `providerId: UUID`
- `providerName: string`
- `fetchedAt: datetime`
- `points: ChargingPointDTO[]`

`ReservationRequestDTO`

- `pointId: UUID`
- `durationMinutes: int`
- `idempotencyKey: string`

`ReservationResultDTO`

- `reservationId: UUID?`
- `pointId: UUID`
- `providerId: UUID`
- `externalPointId: string`
- `status: ReservationStatus`
- `reservationEndsAt: datetime?`
- `pricePerKwh: decimal?`
- `message: string?`

`UsageEventDTO`

- `eventId: UUID`
- `eventType: UsageEventType`
- `actorId: UUID?`
- `providerId: UUID?`
- `pointId: UUID?`
- `reservationId: UUID?`
- `occurredAt: datetime`
- `metadata: object`

`DomainEventDTO`

- `eventId: UUID`
- `eventType: DomainEventType`
- `correlationId: string?`
- `occurredAt: datetime`
- `payload: object`

`AnalyticsQueryDTO`

- `providerId: UUID?`
- `periodStart: datetime`
- `periodEnd: datetime`
- `groupBy: string?`

`AnalyticsSummaryDTO`

- `providerId: UUID?`
- `periodStart: datetime`
- `periodEnd: datetime`
- `searchCount: int`
- `pointViewCount: int`
- `reservationCount: int`
- `confirmedReservationCount: int`
- `revenueAmount: decimal`

`ExportFileDTO`

- `exportJobId: UUID`
- `fileName: string`
- `contentType: string`
- `downloadUrl: string`
- `expiresAt: datetime?`

`InvoiceDTO`

- `invoiceId: UUID`
- `providerId: UUID`
- `periodStart: date`
- `periodEnd: date`
- `status: InvoiceStatus`
- `totalAmount: decimal`
- `issuedAt: datetime`
- `paidAt: datetime?`
- `lines: InvoiceLineDTO[]`

`InvoiceLineDTO`

- `invoiceLineId: UUID`
- `invoiceId: UUID`
- `reservationId: UUID?`
- `description: string`
- `quantity: int`
- `unitAmount: decimal`
- `lineAmount: decimal`

`PaymentDTO`

- `paymentId: UUID`
- `invoiceId: UUID`
- `providerId: UUID`
- `amount: decimal`
- `status: PaymentStatus`
- `externalPaymentId: string?`
- `paidAt: datetime?`

`ApiErrorDTO`

- `code: string`
- `message: string`
- `details: object?`

### Provider-Specific DTOs

`RedPoint`

- `pointid: int`
- `providerName: string`
- `status: string`
- `reservationendtime: string?`
- `cap: int`
- `connector: string?`
- `locationName: string?`
- `address: string?`

`RedReserveResponse`

- `pointid: int`
- `providerName: string`
- `status: string`
- `reservationendtime: string`

`GreenPoint`

- `id: int`
- `providerName: string`
- `state: string`
- `reservedUntil: string?`
- `kwhRateEur: decimal`
- `cap: int`
- `connector: string?`
- `locationName: string?`
- `address: string?`

`GreenReservationRequest`

- `duration: int`

`GreenReserveResponse`

- `id: int`
- `providerName: string`
- `state: string`
- `reservedUntil: string`
- `kwhRateEur: decimal`

`BluePoint`

- `chargerId: int`
- `providerName: string`
- `currentStatus: string`
- `reservationEnd: string?`
- `pricePerKwh: decimal`
- `cap: int`
- `connector: string?`
- `locationName: string?`
- `address: string?`

`BlueReserveResponse`

- `chargerId: int`
- `providerName: string`
- `currentStatus: string`
- `reservationEnd: string`
- `pricePerKwh: decimal`

### Enums

`ProviderType`

- `RED_PLUG`
- `GREEN_PLUG`
- `BLUE_PLUG`
- `CUSTOM`

`ChargingPointStatus`

- `AVAILABLE`
- `OCCUPIED`
- `RESERVED`
- `UNKNOWN`
- `OUT_OF_SERVICE`

`ReservationStatus`

- `CONFIRMED`
- `REJECTED`
- `CANCELLED`
- `EXPIRED`

`UsageEventType`

- `SEARCH_PERFORMED`
- `POINT_VIEWED`
- `RESERVATION_CONFIRMED`
- `RESERVATION_REJECTED`
- `INVOICE_ISSUED`
- `INVOICE_PAID`

`DomainEventType`

- `PROVIDER_CATALOG_SYNC_REQUESTED`
- `PROVIDER_CATALOG_FETCHED`
- `CHARGING_POINT_CATALOG_UPDATED`
- `PROVIDER_STATUS_UPDATED`
- `POINT_VIEWED`
- `SEARCH_PERFORMED`
- `RESERVATION_CONFIRMED`
- `RESERVATION_REJECTED`
- `INVOICE_ISSUED`
- `INVOICE_PAID`

`InvoiceStatus`

- `DRAFT`
- `ISSUED`
- `PAID`
- `OVERDUE`
- `CANCELLED`

`PaymentStatus`

- `PENDING`
- `SUCCEEDED`
- `FAILED`

## API Class Diagram Specification

Model these service API interfaces and operations.

`IdentityApi`

- `startGoogleOAuth(): RedirectResponse`
- `completeGoogleOAuth(code: string): AuthTokenDTO`
- `getCurrentUser(): UserDTO`

`ProviderRegistryApi`

- `registerProvider(request: ProviderRegistrationDTO): ProviderDTO`
- `getOwnProvider(): ProviderDTO`
- `listActiveProviders(): ProviderDTO[]`

`ChargingPointCatalogApi`

- `searchChargingPoints(filters: ChargingPointSearchQueryDTO): ChargingPointDTO[]`
- `getChargingPoint(pointId: UUID): ChargingPointDTO`
- `applyCatalogUpdate(snapshot: ProviderCatalogSnapshotDTO): void`

`ChargingPointStatusApi`

- `getPointStatus(pointId: UUID): ChargingPointStatusDTO`
- `refreshPointStatus(pointId: UUID): ChargingPointStatusDTO`

`ReservationApi`

- `createReservation(request: ReservationRequestDTO): ReservationResultDTO`
- `getReservation(reservationId: UUID): ReservationResultDTO`

`UsageAnalyticsApi`

- `getProviderAnalytics(query: AnalyticsQueryDTO): AnalyticsSummaryDTO`
- `getGlobalAnalytics(query: AnalyticsQueryDTO): AnalyticsSummaryDTO`
- `exportProviderUsageLog(query: AnalyticsQueryDTO): ExportFileDTO`
- `recordUsageEvent(event: UsageEventDTO): void`

`BillingPaymentApi`

- `listProviderInvoices(): InvoiceDTO[]`
- `getInvoice(invoiceId: UUID): InvoiceDTO`
- `payInvoice(invoiceId: UUID, payment: PaymentDTO): PaymentDTO`
- `createInvoiceLinesFromReservation(event: DomainEventDTO): void`

## Public REST API Specification

Use these endpoints in API class and sequence diagrams.

| Service | Endpoint | Request | Response |
| --- | --- | --- | --- |
| `Identity & Access Service` | `GET /api/auth/google/start` | none | redirect |
| `Identity & Access Service` | `GET /api/auth/google/callback` | `code` | `AuthTokenDTO` |
| `Identity & Access Service` | `GET /api/users/me` | none | `UserDTO` |
| `Provider Registry Service` | `POST /api/providers` | `ProviderRegistrationDTO` | `ProviderDTO` |
| `Provider Registry Service` | `GET /api/providers/me` | none | `ProviderDTO` |
| `Charging Point Catalog Service` | `GET /api/charging-points` | query filters | `ChargingPointDTO[]` |
| `Charging Point Catalog Service` | `GET /api/charging-points/{pointId}` | `pointId` | `ChargingPointDTO` |
| `Charging Point Status Service` | `GET /api/status/{pointId}` | `pointId` | `ChargingPointStatusDTO` |
| `Reservation Service` | `POST /api/reservations` | `ReservationRequestDTO` | `ReservationResultDTO` |
| `Reservation Service` | `GET /api/reservations/{reservationId}` | `reservationId` | `ReservationResultDTO` |
| `Usage & Analytics Service` | `GET /api/analytics/provider/me` | `AnalyticsQueryDTO` | `AnalyticsSummaryDTO` |
| `Usage & Analytics Service` | `GET /api/analytics/operator/global` | `AnalyticsQueryDTO` | `AnalyticsSummaryDTO` |
| `Usage & Analytics Service` | `GET /api/analytics/provider/me/export` | `AnalyticsQueryDTO` | `ExportFileDTO` |
| `Billing & Payment Service` | `GET /api/billing/provider/me/invoices` | none | `InvoiceDTO[]` |
| `Billing & Payment Service` | `GET /api/billing/provider/me/invoices/{invoiceId}` | `invoiceId` | `InvoiceDTO` |
| `Billing & Payment Service` | `POST /api/billing/provider/me/invoices/{invoiceId}/pay` | `PaymentDTO` | `PaymentDTO` |

## External Provider API Specification

Model these as external interfaces.

`redPlug API`

- `GET /points`
- `GET /point/{pointid}`
- `POST /reserve/{pointid}`
- `POST /reserve/{pointid}/{minutes}`

`greenPlug API`

- `GET /chargingPoints`
- `GET /chargingPoints/{pointid}`
- `POST /chargingPoints/{pointid}/reservations`

`bluePlug API`

- `GET /locations`
- `GET /location/{pointid}/status`
- `POST /location/{pointid}/hold`

## Persistence / ER Specification

Use a class diagram or ER-style PlantUML diagram. Show database-per-service ownership.

Important modeling rules:

- Each service owns exactly one logical database/schema.
- No service directly joins to another service's tables.
- Cross-service relationships in the diagram are reference/data-flow relationships only, not physical foreign keys.
- If two services need the same business fact, duplicate it as a local snapshot/read model and keep it synchronized through events or service APIs.
- In PlantUML, intra-database relationships can be solid. Cross-service references should be dashed and labeled `reference only` or `event-synced`.

### Cross-Service Data Duplication / Read Models

| Source of truth | Local copies / references | Synchronization path |
| --- | --- | --- |
| `Provider Registry Service` owns `Provider` | `ProviderSyncRun.providerId`, `ChargingPoint.providerId`, `StatusSnapshot.providerId`, `Reservation.providerId`, `UsageEvent.providerId`, `Invoice.providerId`, `Payment.providerId` | provider registry API and catalog/reservation/billing events |
| `Charging Point Catalog Service` owns `ChargingPoint` | `StatusSnapshot.pointId`, `Reservation.pointId`, `UsageEvent.pointId`, invoice line metadata | status events, reservation events, catalog update events |
| `Reservation Service` owns `Reservation` | `UsageEvent.reservationId`, `InvoiceLine.reservationId` | `ReservationConfirmed` and `ReservationRejected` |
| `Identity & Access Service` owns `User` | `Reservation.evUserId`, `UsageEvent.actorId`, `ExportJob.requestedByUserId` | JWT claims and event payloads |
| `Billing & Payment Service` owns `Invoice` and `Payment` | `UsageEvent` for `InvoiceIssued` / `InvoicePaid` analytics | `InvoiceIssued` and `InvoicePaid` |

### `identity_db`

`User`

- `userId: UUID` PK
- `email: string`
- `displayName: string`
- `googleSubject: string?`
- `role: Role`
- `createdAt: datetime`
- `lastLoginAt: datetime?`

`Role`

- `roleCode: string` PK
- `description: string`

Relationships:

- `Role 1 -- * User`

### `providers_db`

`Provider`

- `providerId: UUID` PK
- `providerName: string`
- `providerType: ProviderType`
- `apiBaseUrl: string`
- `contactEmail: string`
- `status: string`
- `registeredAt: datetime`

`ProviderCredential`

- `credentialId: UUID` PK
- `providerId: UUID` FK
- `apiKeyRef: string`
- `createdAt: datetime`
- `rotatedAt: datetime?`

Relationships:

- `Provider 1 -- * ProviderCredential`

### `provider_sync_db`

`ProviderSyncRun`

- `syncRunId: UUID` PK
- `providerId: UUID`
- `startedAt: datetime`
- `finishedAt: datetime?`
- `status: string`
- `pointsFetched: int`
- `pointsChanged: int?`
- `errorMessage: string?`

Relationships:

- `Provider 1 .. * ProviderSyncRun` as `reference only` through `providerId`.

### `catalog_db`

`ChargingPoint`

- `pointId: UUID` PK
- `providerId: UUID`
- `externalPointId: string`
- `locationName: string?`
- `address: string?`
- `latitude: decimal?`
- `longitude: decimal?`
- `connectorType: string?`
- `capacityKw: int`
- `pricePerKwh: decimal?`
- `latestStatus: ChargingPointStatus`
- `latestReservationEndsAt: datetime?`
- `lastCatalogSyncAt: datetime?`
- `lastStatusUpdatedAt: datetime?`

Relationships:

- `Provider 1 .. * ChargingPoint` as `reference only` through `providerId`.

### `status_db`

`StatusSnapshot`

- `statusSnapshotId: UUID` PK
- `pointId: UUID`
- `providerId: UUID`
- `externalPointId: string`
- `status: ChargingPointStatus`
- `reservationEndsAt: datetime?`
- `pricePerKwh: decimal?`
- `observedAt: datetime`

Relationships:

- `ChargingPoint 1 .. * StatusSnapshot` as `event-synced` through `pointId`.

### `reservations_db`

`Reservation`

- `reservationId: UUID` PK
- `pointId: UUID`
- `providerId: UUID`
- `externalPointId: string`
- `evUserId: UUID`
- `durationMinutes: int`
- `status: ReservationStatus`
- `reservationEndsAt: datetime?`
- `pricePerKwh: decimal?`
- `idempotencyKey: string`
- `createdAt: datetime`

Relationships:

- `User 1 .. * Reservation` as `reference only` through `evUserId`.
- `ChargingPoint 1 .. * Reservation` as `reference only` through `pointId`.

### `usage_analytics_db`

`UsageEvent`

- `eventId: UUID` PK
- `eventType: UsageEventType`
- `actorId: UUID?`
- `providerId: UUID?`
- `pointId: UUID?`
- `reservationId: UUID?`
- `occurredAt: datetime`
- `metadataJson: object`

`AnalyticsAggregate`

- `aggregateId: UUID` PK
- `providerId: UUID?`
- `periodStart: datetime`
- `periodEnd: datetime`
- `searchCount: int`
- `pointViewCount: int`
- `reservationCount: int`
- `confirmedReservationCount: int`
- `revenueAmount: decimal`

`ExportJob`

- `exportJobId: UUID` PK
- `providerId: UUID`
- `requestedByUserId: UUID`
- `periodStart: datetime`
- `periodEnd: datetime`
- `status: string`
- `fileUrl: string?`
- `createdAt: datetime`

### `billing_db`

`Invoice`

- `invoiceId: UUID` PK
- `providerId: UUID`
- `periodStart: date`
- `periodEnd: date`
- `status: InvoiceStatus`
- `totalAmount: decimal`
- `issuedAt: datetime`
- `paidAt: datetime?`

`InvoiceLine`

- `invoiceLineId: UUID` PK
- `invoiceId: UUID` FK
- `reservationId: UUID?`
- `description: string`
- `quantity: int`
- `unitAmount: decimal`
- `lineAmount: decimal`

`Payment`

- `paymentId: UUID` PK
- `invoiceId: UUID` FK
- `providerId: UUID`
- `amount: decimal`
- `status: PaymentStatus`
- `externalPaymentId: string?`
- `paidAt: datetime?`

Relationships:

- `Invoice 1 -- * InvoiceLine`
- `Invoice 1 -- * Payment`
- `Provider 1 .. * Invoice` as `reference only` through `providerId`.

## Component Diagram Specification

Show components:

- `Web Frontend`
- `API Gateway`
- `Identity & Access Service`
- `Provider Registry Service`
- `Charging Point Catalog Service`
- `Provider Sync Service`
- `Charging Point Status Service`
- `Reservation Service`
- `Usage & Analytics Service`
- `Billing & Payment Service`
- `Provider Client Library`
- `redPlug Adapter`
- `greenPlug Adapter`
- `bluePlug Adapter`
- `RabbitMQ Message Broker`
- `PostgreSQL`
- `External Payment Gateway`
- `Google OAuth Provider`
- `redPlug API`
- `greenPlug API`
- `bluePlug API`

Required connections:

- `Web Frontend` -> `API Gateway`
- `API Gateway` -> all backend service APIs
- `Identity & Access Service` -> `Google OAuth Provider`
- `Provider Sync Service` -> `Provider Client Library`
- `Charging Point Status Service` -> `Provider Client Library`
- `Reservation Service` -> `Provider Client Library`
- `Provider Client Library` -> provider APIs
- Each service -> its own PostgreSQL database/schema only
- Services -> `RabbitMQ Message Broker` for accepted events
- `Billing & Payment Service` -> `External Payment Gateway`

Each component note must include its GitHub source reference from ADR-013.

## Deployment Diagram Specification

Docker Compose nodes/containers:

| Container | Image/build context | Internal port | Host exposure | Network |
| --- | --- | ---: | --- | --- |
| `api-gateway` | `services/api-gateway` | 80 | `8080:80` | `public_net`, `backend_net` |
| `web-frontend` | `apps/frontend` | 3000 | dev-only `3000:3000` | `public_net` |
| `identity-service` | `services/identity` | 8001 | none | `backend_net`, `data_net` |
| `provider-registry-service` | `services/provider-registry` | 8002 | none | `backend_net`, `data_net` |
| `charging-point-catalog-service` | `services/charging-point-catalog` | 8003 | none | `backend_net`, `data_net` |
| `provider-sync-service` | `services/provider-sync` | 8004 | none | `backend_net`, `data_net` |
| `charging-point-status-service` | `services/charging-point-status` | 8005 | none | `backend_net`, `data_net` |
| `reservation-service` | `services/reservations` | 8006 | none | `backend_net`, `data_net` |
| `usage-analytics-service` | `services/usage-analytics` | 8007 | none | `backend_net`, `data_net` |
| `billing-payment-service` | `services/billing-payment` | 8008 | none | `backend_net`, `data_net` |
| `postgres` | `postgres:16` | 5432 | dev-only `5432:5432` | `data_net` |
| `rabbitmq` | `rabbitmq:3-management` | 5672, 15672 | dev-only `15672:15672` | `data_net` |

External systems:

- `https://davinci.softlab.ntua.gr/saas26/redPlug/api`
- `https://davinci.softlab.ntua.gr/saas26/greenPlug/api`
- `https://davinci.softlab.ntua.gr/saas26/bluePlug/api`
- external or mocked `Payment Gateway`
- Google OAuth provider

Deployment notes:

- Only `api-gateway` is public in the normal deployment.
- Internal services communicate by Docker service name and internal port.
- The `postgres` container hosts separate logical databases/schemas: `identity_db`, `providers_db`, `provider_sync_db`, `catalog_db`, `status_db`, `reservations_db`, `usage_analytics_db`, `billing_db`.
- Each backend service receives credentials only for its own database/schema.
- Provider API credentials, JWT secret, database password, and payment credentials are secrets/environment variables.
- PostgreSQL and RabbitMQ use named Docker volumes.

## Final PlantUML Markup File Plan

The final first-deliverable Markdown file should be named:

- `docs/diagrams/intermediate/saasplug_uml_model.md`

It should contain these PlantUML blocks in this order:

1. `Use Case Diagram`
2. `Activity Diagram - Provider Registration`
3. `Activity Diagram - Provider Catalog Synchronization`
4. `Activity Diagram - Search and Status Refresh`
5. `Activity Diagram - Reservation and Billing`
6. `Class Diagram - Exchanged Data DTOs`
7. `Class Diagram - Service APIs`
8. `Data Design Diagram - Persistence Model`
9. `Component Diagram`
10. `Deployment Diagram`
11. `Sequence Diagram - Login with Google`
12. `Sequence Diagram - Search for a Point`
13. `Sequence Diagram - View Fresh Point Status`
14. `Sequence Diagram - Reservation`
15. `Sequence Diagram - Register to saasCharge`
16. `Sequence Diagram - Provider Catalog Sync`
17. `Sequence Diagram - View Analytics and Export Logs`
18. `Sequence Diagram - View Invoice and Pay Invoice`

## Open Points Before Final UML Generation

- Confirm whether the team wants `Search for a point` to be anonymous in the model. Current decision: anonymous search allowed, reservation requires authentication.
- Confirm whether the team accepts RabbitMQ in the target architecture. Current decision: yes, for internal synchronization only.
- Confirm whether the team accepts FastAPI for backend services. Current decision: proposed target.
- Confirm whether component source links may point to intended future paths before code exists. Current decision: yes, because the assignment needs component-source mapping.
