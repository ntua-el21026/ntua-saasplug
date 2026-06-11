# Final UML Diagrams

This directory contains the final PlantUML diagrams for the saasPlug project submission.

## Purpose

The files in this directory are the authoritative final diagram artifacts for the course deliverable. Older or draft diagrams may exist elsewhere, but only this directory should be treated as the final diagram source.

## Expected contents

The final diagram set should include, at minimum:

- use case diagram
- activity diagrams for the main flows
- component diagram
- deployment diagram
- sequence diagrams
- data/persistence model diagram
- relevant class/interface/data-structure diagrams

Suggested filenames:

```text
use-case.puml
activity-search-reservation.puml
activity-provider-sync.puml
activity-invoice-payment.puml
component.puml
deployment.puml
sequence-search-map.puml
sequence-status-lookup.puml
sequence-reservation.puml
sequence-provider-sync.puml
sequence-analytics-billing.puml
data-model.puml
```

## Naming rules

Use the exact accepted service names from `docs/specs/SPECIFICATIONS.md`, including:

- `auth-service`
- `provider-registry-service`
- `red-provider-service`
- `green-provider-service`
- `blue-provider-service`
- `catalog-service`
- `status-service`
- `reservation-service`
- `analytics-service`
- `billing-service`

Do not introduce alternative names such as `PointService`, `StatsService`, `PaymentService`, or `ProviderAdapterService`.

## Traceability rule

Every component in the final component and deployment diagrams should be traceable to a repository path where possible.

Example:

```plantuml
component "catalog-service\nservices/catalog-service" as CatalogService
database "catalog-postgres" as CatalogPostgres
```

## Update policy

Update final diagrams after implementation or after major service/API changes. The final diagrams must match the implemented repository structure and Docker runtime.
