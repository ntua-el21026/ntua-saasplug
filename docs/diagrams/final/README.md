# Final UML Diagrams

This directory contains the final PlantUML diagram sources for the saasPlug
course submission. These files are code-derived and supersede intermediate or
draft diagrams elsewhere in the repository.

## Diagram Index

| File | Purpose |
|---|---|
| `use-case.puml` | Actor goals and implemented use cases |
| `activity-search-reservation.puml` | EV map search, status lookup, and reservation activity |
| `activity-provider-sync.puml` | Provider adapter sync and catalog import activity |
| `activity-invoice-payment.puml` | Billing charge, invoice issuance, and mock payment activity |
| `component.puml` | Repository components, gateway, services, databases, RabbitMQ, and provider APIs |
| `deployment.puml` | Docker Compose containers, ports, internal network, volumes, and provider API hosts |
| `data-model.puml` | Service-owned persistence model and logical data-flow relationships |
| `class-data-structures.puml` | Exchanged DTOs, event envelope, and event type classes |
| `class-service-apis.puml` | Public and internal service API class model |
| `sequence-login.puml` | Local and Google login, refresh, and current-user lookup |
| `sequence-search-map.puml` | Viewport-radius catalog map search sequence |
| `sequence-status-lookup.puml` | Status cache hit, live refresh, and stale fallback sequence |
| `sequence-reservation.puml` | Reservation idempotency, provider mutation, status seed, and outbox sequence |
| `sequence-provider-sync-catalog-import.puml` | Provider adapter sync and catalog import sequence |
| `sequence-analytics-billing-events.puml` | Event routing to analytics and billing |
| `saasplug-final-uml.md` | Self-contained Markdown file embedding all final PlantUML diagrams |
| `diagram-audit.md` | Final diagram audit, code inventory, naming dictionary, and corrections |

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
scheduler-service
```

Provider codes are `redPlug`, `greenPlug`, and `bluePlug`. Roles are
`EV_USER`, `PROVIDER_ADMIN`, and `OPERATOR`.

## Code-Derived Corrections

- Frontend catalog search is modeled as viewport-derived radius search using
  `centerLat`, `centerLng`, and `radiusKm`.
- Provider adapters are internal HTTP adapter services. They call external
  provider APIs and persist local snapshots, but they do not publish RabbitMQ
  events in the implemented runtime.
- Reservation and billing domain events are staged in service-owned outbox
  tables and published by operator or scheduler outbox drains.
- The frontend container is modeled as a static React/Vite build served by
  Nginx on internal port `5173`.

## Rendering

Render the individual PlantUML sources with:

```bash
plantuml docs/diagrams/final/*.puml
```

Generated PNG/SVG outputs are build artifacts and should not be committed.

## Update Policy

Update these final diagrams whenever implementation, public routes, container
topology, persistence ownership, DTO/API contracts, or event topology change.
