# AGENTS.md

## Project Context

- Repository: `saasPlug`, NTUA ECE course project for "Technologies of Software Services", Spring 2025-2026.
- Course assignment target: a SaaS application that lets EV users search and reserve charging points from multiple charging point providers.
- Architecture constraint from the assignment: microservices, deployed with Docker containers.
- First milestone: UML model due on Friday 2026-04-17. Current environment date during initial orientation was Wednesday 2026-04-15.
- Final delivery: source code, deployment scripts, running Dockerized app, GitHub project management, and AI-tool documentation.

## Standing Working Instructions

- Read this file at the start of each future prompt and update it when durable preferences, decisions, naming conventions, or completed assignment work change.
- Do not modify professor-provided raw materials under `docs/assignment/` or `docs/lectures/` unless explicitly requested.
- Keep terminology consistent across all diagrams, docs, APIs, and code. Prefer the exact SRS/VPP names until we intentionally rename them.
- For the first UML deliverable, use PlantUML unless the user decides otherwise.
- If using PlantUML, organize all diagrams in one Markdown file under `docs/diagrams/intermediate/`, per the assignment.
- Do not proceed from planning/orientation into implementation unless the user explicitly asks for implementation.
- Preserve source-code GitHub references in component diagrams once implementation files exist.
- Deployment diagrams must include ports and describe Docker usage completely.

## Assignment Materials Reviewed

- `docs/assignment/Εκφώνηση Εξαμηνιαίας Εργασίας.pdf`: assignment statement and deliverables.
- `docs/assignment/SRS Εξαμηνιαίας Εργασίας.docx`: SRS text and embedded diagrams.
- `docs/assignment/Διαγράμματα SRS.vpp`: Visual Paradigm SQLite project containing the same SRS diagrams and model elements.
- `docs/assignment/providers/`: hypothetical provider API specs in OpenAPI YAML and Postman collection format.
- `docs/lectures/`: lecture PDFs and slide images, excluding `docs/lectures/bibliography/` for the initial orientation pass.
- `docs/assignment/Project Notes from Lectures.docx`: reviewed after user approval; it affects first UML architecture decisions around messaging, provider calls, local catalog/cache, and API gateway usage.

## SRS Vocabulary To Preserve

- Actors: `Χρήστης EV`, `Charging points provider`, `saasPlug operator`.
- Use cases: `Search for a point`, `Login with Google`, `Reservation`, `Register to saasCharge`, `View own analytics`, `View invoice`, `Pay invoice`, `Export own logs`, `View global analytics`.
- Dataflow/process terms: `Point selection`, `Charging points service registration`, `Status update`, `Analytics, billing`, `Payment processing`.
- Data stores: `Charging points & status`, `Log (reservations, views)`.
- SRS component terms: `saasPlug charging points interface`, `saasPlug core`, `payments service`, `charging points provider 1/2/N`.
- 2025-2026 provider terms: `softPlug provider 1 (redPLUG)`, `softPlug provider 2 (greenPlug)`, `softPlug provider 3 (bluePlug)`, `redAPI`, `greenAPI`, `blueAPI`, project groups `saas26-XX` and `saas26-YY`.

## Provider API Notes

- Swagger UI link from `docs/assignment/providers/swagger_apis_hypothetical_providers.md` was reachable at `https://davinci.softlab.ntua.gr/saas26/swagger`.
- Live OpenAPI endpoint was reachable at `https://davinci.softlab.ntua.gr/saas26/openapi.json`.
- `/saas26/health` returned `{"status":"ok"}`.
- Provider data endpoints require an API key and returned `Invalid API key` without one.
- Local YAML/Postman files match the live provider structure:
  - redPlug: `GET /points`, `GET /point/{pointid}`, `POST /reserve/{pointid}`, `POST /reserve/{pointid}/{minutes}`.
  - greenPlug: `GET /chargingPoints`, `GET /chargingPoints/{pointid}`, `POST /chargingPoints/{pointid}/reservations`.
  - bluePlug: `GET /locations`, `GET /location/{pointid}/status`, `POST /location/{pointid}/hold`.
- Important integration issue: provider schemas use different field names for equivalent concepts, so saasPlug will need normalized internal DTOs.

## Initial UML Direction

- The professor SRS/VPP already gives a baseline use case diagram, dataflow diagram, component diagrams, and a status-update activity diagram.
- First deliverable still needs a consistent complete model: use case, activity, class/data/API, component, deployment, sequence, and persistence design.
- Main modeling risk is consistency: names, API DTOs, services, and data stores must line up across every diagram.
- The provider APIs should probably be modeled both as external provider contracts and normalized internal saasPlug contracts.
- A full diagram-facing architecture/specification document now exists at `docs/diagrams/intermediate/architecture_decisions.md`.
- Current proposed stack for discussion: React TypeScript frontend, FastAPI backend services, PostgreSQL, RabbitMQ for internal synchronization only, API Gateway/reverse proxy, Docker Compose.
- Project Notes decision impact: keep a local charging point catalog/cache; minimize provider calls; use provider list calls on a schedule, provider status/reservation calls synchronously on demand, and RabbitMQ for internal synchronization rather than for external provider command queues.
- Database decision: model database-per-service ownership. A single PostgreSQL container is acceptable in Docker diagrams only as a host for separate logical service databases/schemas with separate credentials; logical DBs are `identity_db`, `providers_db`, `provider_sync_db`, `catalog_db`, `status_db`, `reservations_db`, `usage_analytics_db`, and `billing_db`. Overlapping data is duplicated as event-synced snapshots/read models, not shared through cross-service SQL joins.
- Catalog ownership decision: `Provider Sync Service` fetches and normalizes provider catalog snapshots, then publishes `ProviderCatalogFetched`; `Charging Point Catalog Service` owns the diff against `catalog_db`, persists changes, and publishes `ChargingPointCatalogUpdated`.
- Point resolution decision: status and reservation flows resolve `pointId` through `Charging Point Catalog Service` before calling provider-specific status/reservation APIs.
- Diagram coverage decision: include explicit Google OAuth login, provider registration, provider catalog sync, search/status, reservation/billing, analytics/export, and invoice/payment flows in the first PlantUML deliverable.
- Use case relationship decision: keep the SRS baseline names, but write `<<extend>>` in standard UML direction: `Reservation` extends `Search for a point`, `View invoice` and `Export own logs` extend `View own analytics`, and `Pay invoice` extends `View invoice`.
- First PlantUML deliverable created at `docs/diagrams/intermediate/saasplug_uml_model.md` with 18 embedded PlantUML blocks. Individual editable sources live under `docs/diagrams/intermediate/puml/`.
- Validation note: all `.puml` sources passed PlantUML `-syntax` locally on 2026-04-16. Full image rendering was not checked because Graphviz `dot` is not installed in the local environment.
- Line-ending policy: `.gitattributes` enforces LF for PlantUML, Markdown, source/config text files, and marks course documents/assets as binary to avoid CRLF normalization failures.

## Repo Notes

- `README.md` is minimal.
- `docs/project_structure/project_struct.py` generates a tree report honoring `.gitignore`.
- `docs/diagrams/intermediate/` and `docs/diagrams/final/` exist locally and are the intended diagram locations.
- `docs/ai_logs/` exists locally and should remain available for the AI-tool documentation deliverable.
