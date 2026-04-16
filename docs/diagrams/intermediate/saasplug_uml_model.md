# saasPlug UML Model

This is the PlantUML deliverable for the first part of the NTUA ECE course assignment "Τεχνολογίες Υπηρεσιών Λογισμικού".

The diagrams are embedded below as PlantUML blocks in the required deliverable order. The same sources are also kept as individual `.puml` files under `docs/diagrams/intermediate/puml/` for easier editing and validation.

GitHub source base used in component references:

`https://github.com/ntua-el21026/saasPlug`

## 1. Use Case Diagram

Source: `puml/01_use_case_diagram.puml`

```plantuml
@startuml
title saasPlug - Use Case Diagram
left to right direction
skinparam shadowing false
skinparam packageStyle rectangle

actor "Χρήστης EV" as EVUser
actor "Charging points provider" as Provider
actor "saasPlug operator" as Operator
actor "Google OAuth Provider" as GoogleOAuth <<external>>
actor "External Payment Gateway" as PaymentGateway <<external>>

rectangle "saasPlug" {
  usecase "Search for a point" as SearchForPoint
  usecase "Login with Google\n<<optional 5-6>>" as LoginGoogle
  usecase "Reservation" as Reservation
  usecase "Register to saasCharge" as RegisterSaasCharge
  usecase "View own analytics" as ViewOwnAnalytics
  usecase "View invoice" as ViewInvoice
  usecase "Pay invoice\n<<optional 5-6>>" as PayInvoice
  usecase "Export own logs\n<<optional 5-6>>" as ExportOwnLogs
  usecase "View global analytics\n<<optional 5-6>>" as ViewGlobalAnalytics
}

EVUser --> SearchForPoint
EVUser --> LoginGoogle
GoogleOAuth --> LoginGoogle

Reservation ..> SearchForPoint : <<extend>>
note right of Reservation
  Precondition: authenticated EV_USER.
  Search may remain anonymous.
end note

Provider --> RegisterSaasCharge
Provider --> ViewOwnAnalytics
ViewInvoice ..> ViewOwnAnalytics : <<extend>>
ExportOwnLogs ..> ViewOwnAnalytics : <<extend>>
PayInvoice ..> ViewInvoice : <<extend>>
PaymentGateway --> PayInvoice

Operator --> ViewGlobalAnalytics

@enduml
```

## 2. Activity Diagram - Provider Registration

Source: `puml/02_activity_provider_registration.puml`

```plantuml
@startuml
title saasPlug - Activity Diagram - Provider Registration
skinparam shadowing false

start

partition "Charging points provider" {
  :Sign in as PROVIDER_ADMIN;
  :Fill ProviderRegistrationDTO;
}

partition "Web Frontend" {
  :Submit provider registration form;
}

partition "API Gateway" {
  :POST /api/providers;
}

partition "Provider Registry Service" {
  :Validate JWT role;
  :Validate providerName, providerType,\napiBaseUrl, contactEmail, apiKey;
}

if (Request valid?) then (yes)
  if (Credential probe enabled?) then (yes)
    partition "Provider Client Library" {
      :Select redPlug, greenPlug,\nor bluePlug adapter;
      :Call lightweight provider endpoint;
    }
    if (Provider credential accepted?) then (yes)
    else (no)
      partition "Provider Registry Service" {
        :Return ApiErrorDTO;
      }
      stop
    endif
  else (no)
    partition "Provider Registry Service" {
      :Skip live credential probe;
    }
  endif

  partition "PostgreSQL / providers_db" {
    :Persist Provider;
    :Persist ProviderCredential;
  }

  partition "RabbitMQ Message Broker" {
    :Publish ProviderCatalogSyncRequested;
  }

  partition "Provider Registry Service" {
    :Return ProviderDTO;
  }
else (no)
  partition "Provider Registry Service" {
    :Return ApiErrorDTO;
  }
  stop
endif

stop
@enduml
```

## 3. Activity Diagram - Provider Catalog Synchronization

Source: `puml/03_activity_provider_catalog_sync.puml`

```plantuml
@startuml
title saasPlug - Activity Diagram - Provider Catalog Synchronization
skinparam shadowing false

start

partition "Scheduler" {
  :Trigger nightly catalog sync;
}

partition "Provider Sync Service" {
  :Create ProviderSyncRun in provider_sync_db;
}

partition "Provider Registry Service" {
  :listActiveProviders(): ProviderDTO[];
}

while (More active providers?) is (yes)
  partition "Provider Sync Service" {
    :Select next ProviderDTO;
    :Resolve providerType and apiBaseUrl;
  }

  partition "Provider Client Library" {
    :Select provider adapter;
    :Call provider list endpoint;
  }

  while (Provider call failed and retry budget remains?) is (yes)
    partition "Provider Client Library" {
      :Retry provider list endpoint;
    }
  endwhile (no)

  if (Provider response available?) then (yes)
    partition "Provider Client Library" {
      :Normalize to ProviderCatalogSnapshotDTO;
    }

    partition "RabbitMQ Message Broker" {
      :Publish ProviderCatalogFetched;
    }

    partition "Charging Point Catalog Service" {
      :Consume ProviderCatalogFetched;
    }

    partition "PostgreSQL / catalog_db" {
      :Compute diff against ChargingPoint;
      :Upsert new or changed ChargingPoint rows;
    }

    partition "RabbitMQ Message Broker" {
      :Publish ChargingPointCatalogUpdated;
    }

    partition "Provider Sync Service" {
      :Update ProviderSyncRun as SUCCESS;
    }
  else (no)
    partition "Provider Sync Service" {
      :Update ProviderSyncRun as FAILED;
      :Store errorMessage;
    }
  endif
endwhile (no)

partition "Scheduler" {
  :Wait until next schedule;
}

stop
@enduml
```

## 4. Activity Diagram - Search and Status Refresh

Source: `puml/04_activity_search_status_refresh.puml`

```plantuml
@startuml
title saasPlug - Activity Diagram - Search and Status Refresh
skinparam shadowing false

start

partition "Χρήστης EV" {
  :Enter search filters;
}

partition "Web Frontend" {
  :Build ChargingPointSearchQueryDTO;
}

partition "API Gateway" {
  :GET /api/charging-points;
}

partition "Charging Point Catalog Service" {
  :searchChargingPoints(filters);
}

partition "PostgreSQL / catalog_db" {
  :Read ChargingPoint rows\nand latest cached status;
}

partition "RabbitMQ Message Broker" {
  :Publish SearchPerformed;
}

partition "Usage & Analytics Service" {
  :recordUsageEvent(SearchPerformed);
}

partition "Web Frontend" {
  :Render ChargingPointDTO[];
}

partition "Χρήστης EV" {
  :Select a charging point;
}

if (Fresh status needed?) then (yes)
  partition "API Gateway" {
    :GET /api/status/{pointId};
  }

  partition "Charging Point Status Service" {
    :getPointStatus(pointId);
  }

  partition "Charging Point Catalog Service" {
    :getChargingPoint(pointId);
  }

  partition "Provider Client Library" {
    :Call provider status API using\nproviderId and externalPointId;
    :Normalize to ChargingPointStatusDTO;
  }

  partition "PostgreSQL / status_db" {
    :Persist StatusSnapshot;
  }

  partition "RabbitMQ Message Broker" {
    :Publish ProviderStatusUpdated;
    :Publish PointViewed;
  }

  partition "Charging Point Catalog Service" {
    :Update latest cached status;
  }

  partition "Usage & Analytics Service" {
    :recordUsageEvent(PointViewed);
  }
else (no)
  partition "Web Frontend" {
    :Use cached status from search result;
  }
endif

partition "Web Frontend" {
  :Show point details and status;
}

stop
@enduml
```

## 5. Activity Diagram - Reservation and Billing

Source: `puml/05_activity_reservation_billing.puml`

```plantuml
@startuml
title saasPlug - Activity Diagram - Reservation and Billing
skinparam shadowing false

start

partition "Χρήστης EV" {
  :Request reservation;
}

partition "Web Frontend" {
  :Create ReservationRequestDTO;
}

partition "API Gateway" {
  :POST /api/reservations;
}

partition "Reservation Service" {
  :Validate JWT role EV_USER;
  :Validate idempotencyKey;
}

partition "Charging Point Catalog Service" {
  :getChargingPoint(pointId);
}

partition "Provider Registry Service" {
  :resolveProvider(providerId);
}

partition "Provider Client Library" {
  :Call provider reservation/hold API\nsynchronously;
}

if (Provider accepted reservation?) then (yes)
  partition "PostgreSQL / reservations_db" {
    :Persist Reservation as CONFIRMED;
  }

  partition "Reservation Service" {
    :Return ReservationResultDTO(CONFIRMED);
  }

  partition "RabbitMQ Message Broker" {
    :Publish ReservationConfirmed;
  }

  partition "Usage & Analytics Service" {
    :recordUsageEvent(RESERVATION_CONFIRMED);
  }

  partition "Billing & Payment Service" {
    :Create InvoiceLine from ReservationConfirmed;
  }
else (no)
  partition "PostgreSQL / reservations_db" {
    :Persist Reservation as REJECTED;
  }

  partition "Reservation Service" {
    :Return ReservationResultDTO(REJECTED);
  }

  partition "RabbitMQ Message Broker" {
    :Publish ReservationRejected;
  }

  partition "Usage & Analytics Service" {
    :recordUsageEvent(RESERVATION_REJECTED);
  }
endif

stop
@enduml
```

## 6. Class Diagram - Exchanged Data DTOs

Source: `puml/06_class_exchanged_data_dtos.puml`

```plantuml
@startuml
title saasPlug - Class Diagram - Exchanged Data DTOs
skinparam shadowing false
skinparam packageStyle rectangle
hide circle

package "Normalized saasPlug DTOs" {
  class AuthTokenDTO <<DTO>> {
    +accessToken: string
    +tokenType: string
    +expiresAt: datetime
    +user: UserDTO
  }

  class UserDTO <<DTO>> {
    +userId: UUID
    +email: string
    +displayName: string
    +role: string
  }

  class ProviderDTO <<DTO>> {
    +providerId: UUID
    +providerName: string
    +providerType: ProviderType
    +apiBaseUrl: string
    +contactEmail: string
    +status: string
    +registeredAt: datetime
  }

  class ProviderRegistrationDTO <<DTO>> {
    +providerName: string
    +apiBaseUrl: string
    +apiKey: string
    +providerType: ProviderType
    +contactEmail: string
  }

  class ChargingPointSearchQueryDTO <<DTO>> {
    +providerId: UUID?
    +connectorType: string?
    +status: ChargingPointStatus?
    +minCapacityKw: int?
    +maxPricePerKwh: decimal?
    +nearAddress: string?
    +limit: int
    +offset: int
  }

  class ChargingPointDTO <<DTO>> {
    +pointId: UUID
    +providerId: UUID
    +providerName: string
    +externalPointId: string
    +locationName: string?
    +address: string?
    +latitude: decimal?
    +longitude: decimal?
    +connectorType: string?
    +capacityKw: int
    +pricePerKwh: decimal?
    +status: ChargingPointStatus
    +reservationEndsAt: datetime?
    +lastStatusUpdatedAt: datetime?
  }

  class ChargingPointStatusDTO <<DTO>> {
    +pointId: UUID
    +providerId: UUID
    +externalPointId: string
    +status: ChargingPointStatus
    +reservationEndsAt: datetime?
    +pricePerKwh: decimal?
    +observedAt: datetime
  }

  class ProviderCatalogSnapshotDTO <<DTO>> {
    +providerId: UUID
    +providerName: string
    +fetchedAt: datetime
    +points: ChargingPointDTO[]
  }

  class ReservationRequestDTO <<DTO>> {
    +pointId: UUID
    +durationMinutes: int
    +idempotencyKey: string
  }

  class ReservationResultDTO <<DTO>> {
    +reservationId: UUID?
    +pointId: UUID
    +providerId: UUID
    +externalPointId: string
    +status: ReservationStatus
    +reservationEndsAt: datetime?
    +pricePerKwh: decimal?
    +message: string?
  }

  class UsageEventDTO <<DTO>> {
    +eventId: UUID
    +eventType: UsageEventType
    +actorId: UUID?
    +providerId: UUID?
    +pointId: UUID?
    +reservationId: UUID?
    +occurredAt: datetime
    +metadata: object
  }

  class DomainEventDTO <<DTO>> {
    +eventId: UUID
    +eventType: DomainEventType
    +correlationId: string?
    +occurredAt: datetime
    +payload: object
  }

  class AnalyticsQueryDTO <<DTO>> {
    +providerId: UUID?
    +periodStart: datetime
    +periodEnd: datetime
    +groupBy: string?
  }

  class AnalyticsSummaryDTO <<DTO>> {
    +providerId: UUID?
    +periodStart: datetime
    +periodEnd: datetime
    +searchCount: int
    +pointViewCount: int
    +reservationCount: int
    +confirmedReservationCount: int
    +revenueAmount: decimal
  }

  class ExportFileDTO <<DTO>> {
    +exportJobId: UUID
    +fileName: string
    +contentType: string
    +downloadUrl: string
    +expiresAt: datetime?
  }

  class InvoiceDTO <<DTO>> {
    +invoiceId: UUID
    +providerId: UUID
    +periodStart: date
    +periodEnd: date
    +status: InvoiceStatus
    +totalAmount: decimal
    +issuedAt: datetime
    +paidAt: datetime?
    +lines: InvoiceLineDTO[]
  }

  class InvoiceLineDTO <<DTO>> {
    +invoiceLineId: UUID
    +invoiceId: UUID
    +reservationId: UUID?
    +description: string
    +quantity: int
    +unitAmount: decimal
    +lineAmount: decimal
  }

  class PaymentDTO <<DTO>> {
    +paymentId: UUID
    +invoiceId: UUID
    +providerId: UUID
    +amount: decimal
    +status: PaymentStatus
    +externalPaymentId: string?
    +paidAt: datetime?
  }

  class ApiErrorDTO <<DTO>> {
    +code: string
    +message: string
    +details: object?
  }
}

package "Provider-Specific DTOs" {
  class RedPoint <<external DTO>> {
    +pointid: int
    +providerName: string
    +status: string
    +reservationendtime: string?
    +cap: int
    +connector: string?
    +locationName: string?
    +address: string?
  }

  class RedReserveResponse <<external DTO>> {
    +pointid: int
    +providerName: string
    +status: string
    +reservationendtime: string
  }

  class GreenPoint <<external DTO>> {
    +id: int
    +providerName: string
    +state: string
    +reservedUntil: string?
    +kwhRateEur: decimal
    +cap: int
    +connector: string?
    +locationName: string?
    +address: string?
  }

  class GreenReservationRequest <<external DTO>> {
    +duration: int
  }

  class GreenReserveResponse <<external DTO>> {
    +id: int
    +providerName: string
    +state: string
    +reservedUntil: string
    +kwhRateEur: decimal
  }

  class BluePoint <<external DTO>> {
    +chargerId: int
    +providerName: string
    +currentStatus: string
    +reservationEnd: string?
    +pricePerKwh: decimal
    +cap: int
    +connector: string?
    +locationName: string?
    +address: string?
  }

  class BlueReserveResponse <<external DTO>> {
    +chargerId: int
    +providerName: string
    +currentStatus: string
    +reservationEnd: string
    +pricePerKwh: decimal
  }
}

package "Enums" {
  enum ProviderType {
    RED_PLUG
    GREEN_PLUG
    BLUE_PLUG
    CUSTOM
  }

  enum ChargingPointStatus {
    AVAILABLE
    OCCUPIED
    RESERVED
    UNKNOWN
    OUT_OF_SERVICE
  }

  enum ReservationStatus {
    CONFIRMED
    REJECTED
    CANCELLED
    EXPIRED
  }

  enum UsageEventType {
    SEARCH_PERFORMED
    POINT_VIEWED
    RESERVATION_CONFIRMED
    RESERVATION_REJECTED
    INVOICE_ISSUED
    INVOICE_PAID
  }

  enum DomainEventType {
    PROVIDER_CATALOG_SYNC_REQUESTED
    PROVIDER_CATALOG_FETCHED
    CHARGING_POINT_CATALOG_UPDATED
    PROVIDER_STATUS_UPDATED
    POINT_VIEWED
    SEARCH_PERFORMED
    RESERVATION_CONFIRMED
    RESERVATION_REJECTED
    INVOICE_ISSUED
    INVOICE_PAID
  }

  enum InvoiceStatus {
    DRAFT
    ISSUED
    PAID
    OVERDUE
    CANCELLED
  }

  enum PaymentStatus {
    PENDING
    SUCCEEDED
    FAILED
  }
}

AuthTokenDTO --> UserDTO
ProviderDTO --> ProviderType
ProviderRegistrationDTO --> ProviderType
ChargingPointSearchQueryDTO --> ChargingPointStatus
ChargingPointDTO --> ChargingPointStatus
ChargingPointStatusDTO --> ChargingPointStatus
ProviderCatalogSnapshotDTO "1" o-- "*" ChargingPointDTO
ReservationResultDTO --> ReservationStatus
UsageEventDTO --> UsageEventType
DomainEventDTO --> DomainEventType
AnalyticsQueryDTO ..> AnalyticsSummaryDTO
InvoiceDTO --> InvoiceStatus
InvoiceDTO "1" o-- "*" InvoiceLineDTO
PaymentDTO --> PaymentStatus

RedPoint ..> ChargingPointDTO : normalized to
GreenPoint ..> ChargingPointDTO : normalized to
BluePoint ..> ChargingPointDTO : normalized to
RedReserveResponse ..> ReservationResultDTO : normalized to
GreenReserveResponse ..> ReservationResultDTO : normalized to
BlueReserveResponse ..> ReservationResultDTO : normalized to

@enduml
```

## 7. Class Diagram - Service APIs

Source: `puml/07_class_service_apis.puml`

```plantuml
@startuml
title saasPlug - Class Diagram - Service APIs
allowmixing
skinparam shadowing false
skinparam packageStyle rectangle
hide circle

package "Public and internal service APIs" {
  interface IdentityApi {
    +startGoogleOAuth(): RedirectResponse
    +completeGoogleOAuth(code: string): AuthTokenDTO
    +getCurrentUser(): UserDTO
  }

  interface ProviderRegistryApi {
    +registerProvider(request: ProviderRegistrationDTO): ProviderDTO
    +getOwnProvider(): ProviderDTO
    +listActiveProviders(): ProviderDTO[]
  }

  interface ChargingPointCatalogApi {
    +searchChargingPoints(filters: ChargingPointSearchQueryDTO): ChargingPointDTO[]
    +getChargingPoint(pointId: UUID): ChargingPointDTO
    +applyCatalogUpdate(snapshot: ProviderCatalogSnapshotDTO): void
  }

  interface ChargingPointStatusApi {
    +getPointStatus(pointId: UUID): ChargingPointStatusDTO
    +refreshPointStatus(pointId: UUID): ChargingPointStatusDTO
  }

  interface ReservationApi {
    +createReservation(request: ReservationRequestDTO): ReservationResultDTO
    +getReservation(reservationId: UUID): ReservationResultDTO
  }

  interface UsageAnalyticsApi {
    +getProviderAnalytics(query: AnalyticsQueryDTO): AnalyticsSummaryDTO
    +getGlobalAnalytics(query: AnalyticsQueryDTO): AnalyticsSummaryDTO
    +exportProviderUsageLog(query: AnalyticsQueryDTO): ExportFileDTO
    +recordUsageEvent(event: UsageEventDTO): void
  }

  interface BillingPaymentApi {
    +listProviderInvoices(): InvoiceDTO[]
    +getInvoice(invoiceId: UUID): InvoiceDTO
    +payInvoice(invoiceId: UUID, payment: PaymentDTO): PaymentDTO
    +createInvoiceLinesFromReservation(event: DomainEventDTO): void
  }
}

package "Implemented by components" {
  component "Identity & Access Service" as IdentityService
  component "Provider Registry Service" as ProviderRegistryService
  component "Charging Point Catalog Service" as CatalogService
  component "Charging Point Status Service" as StatusService
  component "Reservation Service" as ReservationService
  component "Usage & Analytics Service" as AnalyticsService
  component "Billing & Payment Service" as BillingService
}

IdentityService ..|> IdentityApi
ProviderRegistryService ..|> ProviderRegistryApi
CatalogService ..|> ChargingPointCatalogApi
StatusService ..|> ChargingPointStatusApi
ReservationService ..|> ReservationApi
AnalyticsService ..|> UsageAnalyticsApi
BillingService ..|> BillingPaymentApi

IdentityApi ..> AuthTokenDTO
IdentityApi ..> UserDTO
ProviderRegistryApi ..> ProviderRegistrationDTO
ProviderRegistryApi ..> ProviderDTO
ChargingPointCatalogApi ..> ChargingPointSearchQueryDTO
ChargingPointCatalogApi ..> ChargingPointDTO
ChargingPointCatalogApi ..> ProviderCatalogSnapshotDTO
ChargingPointStatusApi ..> ChargingPointStatusDTO
ReservationApi ..> ReservationRequestDTO
ReservationApi ..> ReservationResultDTO
UsageAnalyticsApi ..> AnalyticsQueryDTO
UsageAnalyticsApi ..> AnalyticsSummaryDTO
UsageAnalyticsApi ..> ExportFileDTO
UsageAnalyticsApi ..> UsageEventDTO
BillingPaymentApi ..> InvoiceDTO
BillingPaymentApi ..> PaymentDTO
BillingPaymentApi ..> DomainEventDTO

note right of IdentityApi
  GET /api/auth/google/start
  GET /api/auth/google/callback
  GET /api/users/me
end note

note right of ProviderRegistryApi
  POST /api/providers
  GET /api/providers/me
end note

note right of ChargingPointCatalogApi
  GET /api/charging-points
  GET /api/charging-points/{pointId}
end note

note right of ChargingPointStatusApi
  GET /api/status/{pointId}
end note

note right of ReservationApi
  POST /api/reservations
  GET /api/reservations/{reservationId}
end note

note right of UsageAnalyticsApi
  GET /api/analytics/provider/me
  GET /api/analytics/provider/me/export
  GET /api/analytics/operator/global
end note

note right of BillingPaymentApi
  GET /api/billing/provider/me/invoices
  GET /api/billing/provider/me/invoices/{invoiceId}
  POST /api/billing/provider/me/invoices/{invoiceId}/pay
end note

@enduml
```

## 8. Data Design Diagram - Persistence Model

Source: `puml/08_data_design_persistence_model.puml`

```plantuml
@startuml
title saasPlug - Data Design Diagram - Persistence Model
left to right direction
skinparam shadowing false
skinparam packageStyle rectangle
hide circle

package "identity_db\nowned by Identity & Access Service" {
  class "User" as UserEntity <<table>> {
    +userId: UUID <<PK>>
    +email: string
    +displayName: string
    +googleSubject: string?
    +role: Role
    +createdAt: datetime
    +lastLoginAt: datetime?
  }

  class "Role" as RoleEntity <<table>> {
    +roleCode: string <<PK>>
    +description: string
  }

  RoleEntity "1" -- "*" UserEntity
}

package "providers_db\nowned by Provider Registry Service" {
  class "Provider" as ProviderEntity <<table>> {
    +providerId: UUID <<PK>>
    +providerName: string
    +providerType: ProviderType
    +apiBaseUrl: string
    +contactEmail: string
    +status: string
    +registeredAt: datetime
  }

  class "ProviderCredential" as ProviderCredentialEntity <<table>> {
    +credentialId: UUID <<PK>>
    +providerId: UUID <<FK>>
    +apiKeyRef: string
    +createdAt: datetime
    +rotatedAt: datetime?
  }

  ProviderEntity "1" -- "*" ProviderCredentialEntity
}

package "provider_sync_db\nowned by Provider Sync Service" {
  class "ProviderSyncRun" as ProviderSyncRunEntity <<table>> {
    +syncRunId: UUID <<PK>>
    +providerId: UUID
    +startedAt: datetime
    +finishedAt: datetime?
    +status: string
    +pointsFetched: int
    +pointsChanged: int?
    +errorMessage: string?
  }
}

package "catalog_db\nowned by Charging Point Catalog Service" {
  class "ChargingPoint" as ChargingPointEntity <<table>> {
    +pointId: UUID <<PK>>
    +providerId: UUID
    +externalPointId: string
    +locationName: string?
    +address: string?
    +latitude: decimal?
    +longitude: decimal?
    +connectorType: string?
    +capacityKw: int
    +pricePerKwh: decimal?
    +latestStatus: ChargingPointStatus
    +latestReservationEndsAt: datetime?
    +lastCatalogSyncAt: datetime?
    +lastStatusUpdatedAt: datetime?
  }
}

package "status_db\nowned by Charging Point Status Service" {
  class "StatusSnapshot" as StatusSnapshotEntity <<table>> {
    +statusSnapshotId: UUID <<PK>>
    +pointId: UUID
    +providerId: UUID
    +externalPointId: string
    +status: ChargingPointStatus
    +reservationEndsAt: datetime?
    +pricePerKwh: decimal?
    +observedAt: datetime
  }
}

package "reservations_db\nowned by Reservation Service" {
  class "Reservation" as ReservationEntity <<table>> {
    +reservationId: UUID <<PK>>
    +pointId: UUID
    +providerId: UUID
    +externalPointId: string
    +evUserId: UUID
    +durationMinutes: int
    +status: ReservationStatus
    +reservationEndsAt: datetime?
    +pricePerKwh: decimal?
    +idempotencyKey: string
    +createdAt: datetime
  }
}

package "usage_analytics_db\nowned by Usage & Analytics Service" {
  class "UsageEvent" as UsageEventEntity <<table>> {
    +eventId: UUID <<PK>>
    +eventType: UsageEventType
    +actorId: UUID?
    +providerId: UUID?
    +pointId: UUID?
    +reservationId: UUID?
    +occurredAt: datetime
    +metadataJson: object
  }

  class "AnalyticsAggregate" as AnalyticsAggregateEntity <<table>> {
    +aggregateId: UUID <<PK>>
    +providerId: UUID?
    +periodStart: datetime
    +periodEnd: datetime
    +searchCount: int
    +pointViewCount: int
    +reservationCount: int
    +confirmedReservationCount: int
    +revenueAmount: decimal
  }

  class "ExportJob" as ExportJobEntity <<table>> {
    +exportJobId: UUID <<PK>>
    +providerId: UUID
    +requestedByUserId: UUID
    +periodStart: datetime
    +periodEnd: datetime
    +status: string
    +fileUrl: string?
    +createdAt: datetime
  }
}

package "billing_db\nowned by Billing & Payment Service" {
  class "Invoice" as InvoiceEntity <<table>> {
    +invoiceId: UUID <<PK>>
    +providerId: UUID
    +periodStart: date
    +periodEnd: date
    +status: InvoiceStatus
    +totalAmount: decimal
    +issuedAt: datetime
    +paidAt: datetime?
  }

  class "InvoiceLine" as InvoiceLineEntity <<table>> {
    +invoiceLineId: UUID <<PK>>
    +invoiceId: UUID <<FK>>
    +reservationId: UUID?
    +description: string
    +quantity: int
    +unitAmount: decimal
    +lineAmount: decimal
  }

  class "Payment" as PaymentEntity <<table>> {
    +paymentId: UUID <<PK>>
    +invoiceId: UUID <<FK>>
    +providerId: UUID
    +amount: decimal
    +status: PaymentStatus
    +externalPaymentId: string?
    +paidAt: datetime?
  }

  InvoiceEntity "1" -- "*" InvoiceLineEntity
  InvoiceEntity "1" -- "*" PaymentEntity
}

ProviderEntity ..> ProviderSyncRunEntity : reference only\nproviderId
ProviderEntity ..> ChargingPointEntity : reference only\nproviderId
ProviderEntity ..> StatusSnapshotEntity : reference only\nproviderId
ProviderEntity ..> ReservationEntity : reference only\nproviderId
ProviderEntity ..> InvoiceEntity : reference only\nproviderId
UserEntity ..> ReservationEntity : reference only\nevUserId
UserEntity ..> UsageEventEntity : JWT/event-synced\nactorId
UserEntity ..> ExportJobEntity : reference only\nrequestedByUserId
ChargingPointEntity ..> StatusSnapshotEntity : event-synced\npointId
ChargingPointEntity ..> ReservationEntity : reference only\npointId
ChargingPointEntity ..> UsageEventEntity : event-synced\npointId
ReservationEntity ..> UsageEventEntity : event-synced\nreservationId
ReservationEntity ..> InvoiceLineEntity : event-synced\nreservationId
InvoiceEntity ..> UsageEventEntity : event-synced\nInvoiceIssued/InvoicePaid

note bottom
  Database-per-service rule:
  direct SQL access is allowed only inside the owning service.
  Dashed cross-database links are identifiers, snapshots,
  or event-synced read models, not physical foreign keys.
end note

@enduml
```

## 9. Component Diagram

Source: `puml/09_component_diagram.puml`

```plantuml
@startuml
title saasPlug - Component Diagram
left to right direction
skinparam shadowing false
skinparam componentStyle rectangle
skinparam packageStyle rectangle

package "Client" {
  component "Web Frontend\nsource: apps/frontend" as WebFrontend
}

package "Gateway" {
  component "API Gateway\nsource: services/api-gateway" as APIGateway
}

package "Backend microservices" {
  component "Identity & Access Service\nsource: services/identity" as IdentityService
  component "Provider Registry Service\nsource: services/provider-registry" as ProviderRegistryService
  component "Provider Sync Service\nsource: services/provider-sync" as ProviderSyncService
  component "Charging Point Catalog Service\nsource: services/charging-point-catalog" as CatalogService
  component "Charging Point Status Service\nsource: services/charging-point-status" as StatusService
  component "Reservation Service\nsource: services/reservations" as ReservationService
  component "Usage & Analytics Service\nsource: services/usage-analytics" as AnalyticsService
  component "Billing & Payment Service\nsource: services/billing-payment" as BillingService
}

package "Provider integration" {
  component "Provider Client Library\nsource: packages/provider-clients" as ProviderClient
  component "redPlug Adapter\nsource: packages/provider-clients/redplug" as RedAdapter
  component "greenPlug Adapter\nsource: packages/provider-clients/greenplug" as GreenAdapter
  component "bluePlug Adapter\nsource: packages/provider-clients/blueplug" as BlueAdapter
}

package "Data and messaging" {
  database "PostgreSQL\nsource: deploy" as Postgres
  queue "RabbitMQ Message Broker\nsource: deploy" as RabbitMQ
}

package "External systems" {
  component "Google OAuth Provider\nexternal" as GoogleOAuth
  component "External Payment Gateway\nexternal or mocked" as PaymentGateway
  component "redPlug API\nexternal" as RedPlugApi
  component "greenPlug API\nexternal" as GreenPlugApi
  component "bluePlug API\nexternal" as BluePlugApi
}

WebFrontend --> APIGateway : HTTPS\n/api/*

APIGateway --> IdentityService : /api/auth/*\n/api/users/*
APIGateway --> ProviderRegistryService : /api/providers/*
APIGateway --> CatalogService : /api/charging-points/*
APIGateway --> StatusService : /api/status/*
APIGateway --> ReservationService : /api/reservations/*
APIGateway --> AnalyticsService : /api/analytics/*
APIGateway --> BillingService : /api/billing/*

IdentityService --> GoogleOAuth : OAuth 2.0
IdentityService --> Postgres : identity_db
ProviderRegistryService --> Postgres : providers_db
ProviderSyncService --> Postgres : provider_sync_db
CatalogService --> Postgres : catalog_db
StatusService --> Postgres : status_db
ReservationService --> Postgres : reservations_db
AnalyticsService --> Postgres : usage_analytics_db
BillingService --> Postgres : billing_db

ProviderSyncService --> ProviderRegistryService : listActiveProviders()
StatusService --> CatalogService : getChargingPoint(pointId)
ReservationService --> CatalogService : getChargingPoint(pointId)
ReservationService --> ProviderRegistryService : resolveProvider(providerId)

ProviderSyncService --> ProviderClient : list points
StatusService --> ProviderClient : status
ReservationService --> ProviderClient : reserve/hold
ProviderClient *-- RedAdapter
ProviderClient *-- GreenAdapter
ProviderClient *-- BlueAdapter
RedAdapter --> RedPlugApi : redAPI
GreenAdapter --> GreenPlugApi : greenAPI
BlueAdapter --> BluePlugApi : blueAPI

ProviderSyncService --> RabbitMQ : ProviderCatalogFetched
CatalogService --> RabbitMQ : ChargingPointCatalogUpdated
StatusService --> RabbitMQ : ProviderStatusUpdated\nPointViewed
ReservationService --> RabbitMQ : ReservationConfirmed\nReservationRejected
AnalyticsService --> RabbitMQ : consume usage events
BillingService --> RabbitMQ : consume ReservationConfirmed\npublish InvoiceIssued/InvoicePaid
BillingService --> PaymentGateway : authorize/capture payment

note bottom
  GitHub source base:
  https://github.com/ntua-el21026/saasPlug

  Every saasPlug component label includes its intended
  source path under this repository.
end note

@enduml
```

## 10. Deployment Diagram

Source: `puml/10_deployment_diagram.puml`

```plantuml
@startuml
title saasPlug - Deployment Diagram - Docker Compose Target
left to right direction
skinparam shadowing false
skinparam packageStyle rectangle

node "User device" as UserDevice {
  artifact "Browser" as Browser
}

cloud "Internet" as Internet

node "Docker host / VM" as DockerHost {
  frame "Docker Compose project: saasplug" {
    node "public_net" {
      node "api-gateway\ncontainer: api-gateway\nimage/build: services/api-gateway\ninternal: 80\nhost: 8080 -> 80" as Gateway
      node "web-frontend\ncontainer: web-frontend\nimage/build: apps/frontend\ninternal: 3000\nhost: dev 3000 -> 3000" as Frontend
    }

    node "backend_net" {
      node "identity-service\nservices/identity\ninternal: 8001\nhost: none" as Identity
      node "provider-registry-service\nservices/provider-registry\ninternal: 8002\nhost: none" as ProviderRegistry
      node "charging-point-catalog-service\nservices/charging-point-catalog\ninternal: 8003\nhost: none" as Catalog
      node "provider-sync-service\nservices/provider-sync\ninternal: 8004\nhost: none" as ProviderSync
      node "charging-point-status-service\nservices/charging-point-status\ninternal: 8005\nhost: none" as Status
      node "reservation-service\nservices/reservations\ninternal: 8006\nhost: none" as Reservations
      node "usage-analytics-service\nservices/usage-analytics\ninternal: 8007\nhost: none" as Analytics
      node "billing-payment-service\nservices/billing-payment\ninternal: 8008\nhost: none" as Billing
    }

    node "data_net" {
      database "postgres\nimage: postgres:16\ninternal: 5432\nhost: dev 5432 -> 5432\nvolume: postgres_data" as Postgres
      queue "rabbitmq\nimage: rabbitmq:3-management\nAMQP: 5672\nmanagement: dev 15672 -> 15672\nvolume: rabbitmq_data" as RabbitMQ
    }
  }
}

cloud "Google OAuth Provider" as GoogleOAuth
cloud "External Payment Gateway\nor course mock" as PaymentGateway
cloud "davinci.softlab.ntua.gr/saas26" as ProviderApis {
  node "redPlug API" as RedPlug
  node "greenPlug API" as GreenPlug
  node "bluePlug API" as BluePlug
}

Browser --> Internet : HTTPS
Internet --> Gateway : host port 8080
Gateway --> Frontend : /
Gateway --> Identity : /api/auth/*\n/api/users/*
Gateway --> ProviderRegistry : /api/providers/*
Gateway --> Catalog : /api/charging-points/*
Gateway --> Status : /api/status/*
Gateway --> Reservations : /api/reservations/*
Gateway --> Analytics : /api/analytics/*
Gateway --> Billing : /api/billing/*

Identity --> Postgres : identity_db
ProviderRegistry --> Postgres : providers_db
ProviderSync --> Postgres : provider_sync_db
Catalog --> Postgres : catalog_db
Status --> Postgres : status_db
Reservations --> Postgres : reservations_db
Analytics --> Postgres : usage_analytics_db
Billing --> Postgres : billing_db

ProviderSync --> RabbitMQ : publish catalog events
Catalog --> RabbitMQ : publish catalog updates
Status --> RabbitMQ : publish status/view events
Reservations --> RabbitMQ : publish reservation events
Analytics --> RabbitMQ : consume usage events
Billing --> RabbitMQ : consume/publish billing events

Identity --> GoogleOAuth : OAuth HTTPS
ProviderSync --> RedPlug : HTTPS list
ProviderSync --> GreenPlug : HTTPS list
ProviderSync --> BluePlug : HTTPS list
Status --> ProviderApis : HTTPS status
Reservations --> ProviderApis : HTTPS reservation/hold
Billing --> PaymentGateway : HTTPS payment

note right of Postgres
  Separate logical DBs/schemas and credentials:
  identity_db
  providers_db
  provider_sync_db
  catalog_db
  status_db
  reservations_db
  usage_analytics_db
  billing_db
end note

note bottom of DockerHost
  Secrets/environment:
  provider API keys, JWT signing secret,
  database password, payment credentials.

  Normal public exposure:
  only api-gateway host port 8080.
  Frontend, PostgreSQL and RabbitMQ management
  host ports are dev-only.
end note

@enduml
```

## 11. Sequence Diagram - Login with Google

Source: `puml/11_sequence_login_google.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - Login with Google
skinparam shadowing false
autonumber

actor "Χρήστης EV" as EVUser
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Identity & Access Service" as Identity
participant "Google OAuth Provider" as Google
database "identity_db" as IdentityDb

EVUser -> Web : Click "Login with Google"
Web -> Gateway : GET /api/auth/google/start
Gateway -> Identity : startGoogleOAuth()
Identity --> Gateway : 302 redirect to Google
Gateway --> Web : 302 redirect
Web -> Google : OAuth consent/login
Google --> Web : redirect /api/auth/google/callback?code
Web -> Gateway : GET /api/auth/google/callback?code
Gateway -> Identity : completeGoogleOAuth(code)
Identity -> Google : exchange code for Google profile
Google --> Identity : googleSubject, email, displayName
Identity -> IdentityDb : upsertUser(googleSubject, email, displayName, EV_USER)
IdentityDb --> Identity : User
Identity --> Gateway : AuthTokenDTO
Gateway --> Web : AuthTokenDTO
Web --> EVUser : Authenticated EV_USER session

@enduml
```

## 12. Sequence Diagram - Search for a Point

Source: `puml/12_sequence_search_point.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - Search for a Point
skinparam shadowing false
autonumber

actor "Χρήστης EV" as EVUser
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Charging Point Catalog Service" as Catalog
database "catalog_db" as CatalogDb
queue "RabbitMQ Message Broker" as RabbitMQ
participant "Usage & Analytics Service" as Analytics
database "usage_analytics_db" as AnalyticsDb

EVUser -> Web : Enter filters
Web -> Gateway : GET /api/charging-points?filters
Gateway -> Catalog : searchChargingPoints(ChargingPointSearchQueryDTO)
Catalog -> CatalogDb : query ChargingPoint by filters
CatalogDb --> Catalog : ChargingPoint[]
Catalog --> Gateway : ChargingPointDTO[]
Gateway --> Web : ChargingPointDTO[]
Web --> EVUser : Display matching charging points

Catalog -> RabbitMQ : publish SearchPerformed
RabbitMQ -> Analytics : deliver SearchPerformed
Analytics -> AnalyticsDb : recordUsageEvent(SEARCH_PERFORMED)

@enduml
```

## 13. Sequence Diagram - View Fresh Point Status

Source: `puml/13_sequence_view_fresh_status.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - View Fresh Point Status
skinparam shadowing false
autonumber

actor "Χρήστης EV" as EVUser
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Charging Point Status Service" as StatusService
participant "Charging Point Catalog Service" as Catalog
database "catalog_db" as CatalogDb
participant "Provider Client Library" as ProviderClient
participant "redPlug API / greenPlug API / bluePlug API" as ProviderApi
database "status_db" as StatusDb
queue "RabbitMQ Message Broker" as RabbitMQ
participant "Usage & Analytics Service" as Analytics

EVUser -> Web : Open point details
Web -> Gateway : GET /api/status/{pointId}
Gateway -> StatusService : getPointStatus(pointId)
StatusService -> Catalog : getChargingPoint(pointId)
Catalog -> CatalogDb : find ChargingPoint
CatalogDb --> Catalog : ChargingPointDTO
Catalog --> StatusService : ChargingPointDTO
StatusService -> ProviderClient : refreshPointStatus(ChargingPointDTO)

alt redPlug
  ProviderClient -> ProviderApi : GET /point/{pointid}
else greenPlug
  ProviderClient -> ProviderApi : GET /chargingPoints/{pointid}
else bluePlug
  ProviderClient -> ProviderApi : GET /location/{pointid}/status
end

ProviderApi --> ProviderClient : provider-specific status DTO
ProviderClient --> StatusService : ChargingPointStatusDTO
StatusService -> StatusDb : persist StatusSnapshot
StatusService -> RabbitMQ : publish ProviderStatusUpdated
StatusService -> RabbitMQ : publish PointViewed
RabbitMQ -> Catalog : deliver ProviderStatusUpdated
Catalog -> CatalogDb : update latestStatus cache
RabbitMQ -> Analytics : deliver PointViewed
Analytics -> Analytics : recordUsageEvent(POINT_VIEWED)
StatusService --> Gateway : ChargingPointStatusDTO
Gateway --> Web : ChargingPointStatusDTO
Web --> EVUser : Show fresh status

@enduml
```

## 14. Sequence Diagram - Reservation

Source: `puml/14_sequence_reservation.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - Reservation
skinparam shadowing false
autonumber

actor "Χρήστης EV" as EVUser
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Reservation Service" as ReservationService
participant "Charging Point Catalog Service" as Catalog
participant "Provider Registry Service" as ProviderRegistry
participant "Provider Client Library" as ProviderClient
participant "redPlug API / greenPlug API / bluePlug API" as ProviderApi
database "reservations_db" as ReservationsDb
queue "RabbitMQ Message Broker" as RabbitMQ
participant "Usage & Analytics Service" as Analytics
participant "Billing & Payment Service" as Billing

EVUser -> Web : Request reservation
Web -> Gateway : POST /api/reservations\nReservationRequestDTO
Gateway -> ReservationService : createReservation(request)
ReservationService -> ReservationService : validate JWT role EV_USER\nand idempotencyKey
ReservationService -> Catalog : getChargingPoint(pointId)
Catalog --> ReservationService : ChargingPointDTO
ReservationService -> ProviderRegistry : resolveProvider(providerId)
ProviderRegistry --> ReservationService : ProviderDTO
ReservationService -> ProviderClient : reserve(ProviderDTO, ChargingPointDTO, durationMinutes)

alt redPlug
  ProviderClient -> ProviderApi : POST /reserve/{pointid}/{minutes}
else greenPlug
  ProviderClient -> ProviderApi : POST /chargingPoints/{pointid}/reservations
else bluePlug
  ProviderClient -> ProviderApi : POST /location/{pointid}/hold
end

ProviderApi --> ProviderClient : provider-specific reserve response
ProviderClient --> ReservationService : ReservationResultDTO

alt Provider accepted
  ReservationService -> ReservationsDb : save Reservation(CONFIRMED)
  ReservationService -> RabbitMQ : publish ReservationConfirmed
  RabbitMQ -> Analytics : deliver ReservationConfirmed
  Analytics -> Analytics : recordUsageEvent(RESERVATION_CONFIRMED)
  RabbitMQ -> Billing : deliver ReservationConfirmed
  Billing -> Billing : createInvoiceLinesFromReservation(DomainEventDTO)
else Provider rejected
  ReservationService -> ReservationsDb : save Reservation(REJECTED)
  ReservationService -> RabbitMQ : publish ReservationRejected
  RabbitMQ -> Analytics : deliver ReservationRejected
  Analytics -> Analytics : recordUsageEvent(RESERVATION_REJECTED)
end

ReservationService --> Gateway : ReservationResultDTO
Gateway --> Web : ReservationResultDTO
Web --> EVUser : Show confirmation or rejection

@enduml
```

## 15. Sequence Diagram - Register to saasCharge

Source: `puml/15_sequence_register_saascharge.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - Register to saasCharge
skinparam shadowing false
autonumber

actor "Charging points provider" as Provider
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Identity & Access Service" as Identity
participant "Provider Registry Service" as Registry
participant "Provider Client Library" as ProviderClient
participant "redPlug API / greenPlug API / bluePlug API" as ProviderApi
database "providers_db" as ProvidersDb
queue "RabbitMQ Message Broker" as RabbitMQ
participant "Provider Sync Service" as ProviderSync

Provider -> Web : Submit provider registration
Web -> Gateway : GET /api/users/me
Gateway -> Identity : getCurrentUser()
Identity --> Gateway : UserDTO(role=PROVIDER_ADMIN)
Gateway --> Web : UserDTO
Web -> Gateway : POST /api/providers\nProviderRegistrationDTO
Gateway -> Registry : registerProvider(request)
Registry -> Registry : validate request and role

opt Credential probe enabled
  Registry -> ProviderClient : probeProvider(request)
  ProviderClient -> ProviderApi : lightweight list/status call
  ProviderApi --> ProviderClient : accepted
  ProviderClient --> Registry : credential valid
end

Registry -> ProvidersDb : save Provider
Registry -> ProvidersDb : save ProviderCredential(apiKeyRef)
Registry -> RabbitMQ : publish ProviderCatalogSyncRequested
RabbitMQ -> ProviderSync : deliver ProviderCatalogSyncRequested
ProviderSync -> ProviderSync : schedule initial catalog sync
Registry --> Gateway : ProviderDTO
Gateway --> Web : ProviderDTO
Web --> Provider : Registration accepted

@enduml
```

## 16. Sequence Diagram - Provider Catalog Sync

Source: `puml/16_sequence_provider_catalog_sync.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - Provider Catalog Sync
skinparam shadowing false
autonumber

actor "Scheduler" as Scheduler
participant "Provider Sync Service" as ProviderSync
database "provider_sync_db" as SyncDb
participant "Provider Registry Service" as Registry
participant "Provider Client Library" as ProviderClient
participant "redPlug API / greenPlug API / bluePlug API" as ProviderApi
queue "RabbitMQ Message Broker" as RabbitMQ
participant "Charging Point Catalog Service" as Catalog
database "catalog_db" as CatalogDb

Scheduler -> ProviderSync : runScheduledSync()
ProviderSync -> SyncDb : create ProviderSyncRun(STARTED)
ProviderSync -> Registry : listActiveProviders()
Registry --> ProviderSync : ProviderDTO[]

loop for each active provider
  ProviderSync -> ProviderClient : fetchCatalog(ProviderDTO)

  alt redPlug
    ProviderClient -> ProviderApi : GET /points
  else greenPlug
    ProviderClient -> ProviderApi : GET /chargingPoints
  else bluePlug
    ProviderClient -> ProviderApi : GET /locations
  end

  ProviderApi --> ProviderClient : provider-specific point list
  ProviderClient --> ProviderSync : ProviderCatalogSnapshotDTO
  ProviderSync -> RabbitMQ : publish ProviderCatalogFetched
  RabbitMQ -> Catalog : deliver ProviderCatalogFetched
  Catalog -> CatalogDb : computeCatalogDiff(snapshot)
  Catalog -> CatalogDb : upsertChargingPoints(diff)
  Catalog -> RabbitMQ : publish ChargingPointCatalogUpdated
  RabbitMQ -> ProviderSync : deliver ChargingPointCatalogUpdated
  ProviderSync -> SyncDb : update ProviderSyncRun(SUCCESS, counts)
end

ProviderSync --> Scheduler : sync completed

@enduml
```

## 17. Sequence Diagram - View Analytics and Export Logs

Source: `puml/17_sequence_analytics_export.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - View Analytics and Export Logs
skinparam shadowing false
autonumber

actor "Charging points provider" as Provider
actor "saasPlug operator" as Operator
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Usage & Analytics Service" as Analytics
database "usage_analytics_db" as AnalyticsDb

Provider -> Web : Open provider analytics
Web -> Gateway : GET /api/analytics/provider/me
Gateway -> Analytics : getProviderAnalytics(AnalyticsQueryDTO)
Analytics -> AnalyticsDb : read AnalyticsAggregate and UsageEvent\nfiltered by providerId
AnalyticsDb --> Analytics : aggregate data
Analytics --> Gateway : AnalyticsSummaryDTO
Gateway --> Web : AnalyticsSummaryDTO
Web --> Provider : Show own analytics

Provider -> Web : Export own logs
Web -> Gateway : GET /api/analytics/provider/me/export
Gateway -> Analytics : exportProviderUsageLog(AnalyticsQueryDTO)
Analytics -> AnalyticsDb : create ExportJob
Analytics -> AnalyticsDb : read UsageEvent rows
Analytics -> AnalyticsDb : store fileUrl on ExportJob
Analytics --> Gateway : ExportFileDTO
Gateway --> Web : ExportFileDTO
Web --> Provider : Download usage export

Operator -> Web : Open global analytics
Web -> Gateway : GET /api/analytics/operator/global
Gateway -> Analytics : getGlobalAnalytics(AnalyticsQueryDTO)
Analytics -> AnalyticsDb : read global AnalyticsAggregate
AnalyticsDb --> Analytics : aggregate data
Analytics --> Gateway : AnalyticsSummaryDTO
Gateway --> Web : AnalyticsSummaryDTO
Web --> Operator : Show global analytics

@enduml
```

## 18. Sequence Diagram - View Invoice and Pay Invoice

Source: `puml/18_sequence_invoice_payment.puml`

```plantuml
@startuml
title saasPlug - Sequence Diagram - View Invoice and Pay Invoice
skinparam shadowing false
autonumber

actor "Charging points provider" as Provider
participant "Web Frontend" as Web
participant "API Gateway" as Gateway
participant "Billing & Payment Service" as Billing
database "billing_db" as BillingDb
participant "External Payment Gateway" as PaymentGateway
queue "RabbitMQ Message Broker" as RabbitMQ
participant "Usage & Analytics Service" as Analytics

Provider -> Web : Open invoices
Web -> Gateway : GET /api/billing/provider/me/invoices
Gateway -> Billing : listProviderInvoices()
Billing -> BillingDb : query Invoice by providerId
BillingDb --> Billing : Invoice[]
Billing --> Gateway : InvoiceDTO[]
Gateway --> Web : InvoiceDTO[]
Web --> Provider : Show invoices

Provider -> Web : Pay selected invoice
Web -> Gateway : POST /api/billing/provider/me/invoices/{invoiceId}/pay\nPaymentDTO
Gateway -> Billing : payInvoice(invoiceId, payment)
Billing -> BillingDb : get Invoice
BillingDb --> Billing : Invoice
Billing -> PaymentGateway : authorize/capture amount

alt Payment succeeded
  PaymentGateway --> Billing : externalPaymentId, success
  Billing -> BillingDb : save Payment(SUCCEEDED)
  Billing -> BillingDb : mark Invoice(PAID)
  Billing -> RabbitMQ : publish InvoicePaid
  RabbitMQ -> Analytics : deliver InvoicePaid
  Analytics -> Analytics : recordUsageEvent(INVOICE_PAID)
  Billing --> Gateway : PaymentDTO(SUCCEEDED)
else Payment failed
  PaymentGateway --> Billing : failure
  Billing -> BillingDb : save Payment(FAILED)
  Billing --> Gateway : PaymentDTO(FAILED)
end

Gateway --> Web : PaymentDTO
Web --> Provider : Show payment result

@enduml
```
