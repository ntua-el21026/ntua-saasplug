# Final UML Diagrams

This directory contains the final PlantUML diagram sources for the saasPlug
course submission. These files are the authoritative final diagrams; older
drafts and intermediate diagrams elsewhere in the repository are historical
only.

## Diagram Index

| File | Purpose |
|---|---|
| `use-case.puml` | Actor goals and MVP use cases |
| `component.puml` | Repository components, gateway, services, databases, RabbitMQ, and provider APIs |
| `deployment.puml` | Docker Compose containers, public ports, internal ports, and persistence |
| `data-model.puml` | Service-owned persistence model and logical relationships |
| `activity-search-reservation.puml` | EV search, status, and reservation activity |
| `activity-provider-sync.puml` | Provider sync, snapshot, catalog import, and analytics propagation activity |
| `activity-invoice-payment.puml` | Billing charge, invoice issuance, and mock payment activity |
| `sequence-login.puml` | Login and current-user lookup sequence |
| `sequence-search-map.puml` | Bounds-based catalog map search sequence |
| `sequence-status-lookup.puml` | Status cache hit/miss/fallback sequence |
| `sequence-reservation.puml` | Synchronous reservation provider-call sequence |
| `sequence-provider-sync-catalog-import.puml` | Provider snapshot and catalog import sequence |
| `sequence-analytics-billing-events.puml` | Reservation event propagation to analytics and billing |

## Naming Rules

Final diagrams use the accepted service names from
`docs/specs/SPECIFICATIONS.md`:

```text
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
```

Provider codes are `redPlug`, `greenPlug`, and `bluePlug`. Roles are
`EV_USER`, `PROVIDER_ADMIN`, and `OPERATOR`.

## Traceability

Component and deployment diagrams include repository paths or container names
where practical, for example:

```plantuml
component "catalog-service\nservices/catalog-service" as CatalogService
database "catalog-postgres" as CatalogPostgres
```

## Rendering

Render with any PlantUML-compatible tool. Example:

```bash
plantuml docs/diagrams/final/*.puml
```

## Update Policy

Update these final diagrams whenever implementation, public routes, container
topology, persistence ownership, or accepted specifications change.
