# AGENTS.md

## 1. Project Identity

Repository: `saasPlug`  
Course: NTUA ECE - Technologies of Software Services  
Academic year: 2025-2026  
Application type: SaaS web application  
Architecture: microservices with Dockerized deployment  
Primary implementation language for repository content: English  
Planning/discussion language with the user: Greek

saasPlug allows EV users to search for and reserve charging points from multiple charging infrastructure providers. Providers expose their charging-point APIs to saasPlug, view usage analytics, receive invoices, pay issued invoices through a mock payment flow, and export their own usage logs.

The application integrates the hypothetical providers:

- `redPlug`
- `greenPlug`
- `bluePlug`

Each provider has its own OpenAPI YAML specification and schema. Provider-specific services must normalize those APIs into internal DTOs.

---

## 2. Mandatory Reading Before Any Task

Before making any implementation, documentation, diagram, or repository-structure change, read:

1. `AGENTS.md`
2. `docs/specs/SPECIFICATIONS.md`
3. the relevant service/package README if it exists
4. relevant provider YAML files, when available through authorized private course
   access, when working on provider adapters:
   - `docs/assignment/providers/yaml/redPlug.yaml`
   - `docs/assignment/providers/yaml/greenPlug.yaml`
   - `docs/assignment/providers/yaml/bluePlug.yaml`

The original course/provider documents listed in `docs/material-provenance.json`
are intentionally omitted pending redistribution permission. Report that those
private references are unavailable; use the accepted specifications, existing
adapter implementations, and mocked tests for work that does not require the raw
references. Obtain authorized access before a task that requires them. Do not
recreate or download omitted materials automatically. Report any other missing
required file before proceeding unless the task is specifically to create it.

---

## 3. Sources of Truth

Use the following priority order:

1. Assignment statement and professor-provided SRS.
2. `Project Notes from Lectures.docx` and decisions derived from it.
3. Provider OpenAPI specs for `redPlug`, `greenPlug`, and `bluePlug`.
4. Course lecture material.
5. Existing intermediate diagrams and first-phase repository artifacts.
6. Accepted SPEC decisions in `docs/specs/SPECIFICATIONS.md`.

Existing first-phase diagrams and historical architecture notes are not binding if they conflict with accepted SPEC decisions. Update final diagrams and implementation to match accepted SPECs.

---

## 4. Global Repository Rules

- All repository content must be written in English, including code comments, README files, documentation, Codex prompts, AI logs, diagram labels where practical, and issue descriptions where practical.
- Do not modify professor-provided raw materials under `docs/assignment/` or `docs/lectures/` unless explicitly requested.
- Do not commit real secrets.
- Do not commit `.env`.
- Keep `.env.example` with safe placeholders.
- Keep terminology consistent across code, APIs, diagrams, documentation, and tests.
- Do not rename accepted services, roles, provider codes, event names, or major folders without explicit user approval.
- Do not add new services, databases, brokers, frameworks, or infrastructure outside the accepted SPECs unless explicitly requested.
- Do not replace the accepted architecture with a simpler monolith or a different microservices split.

---

## 5. Canonical Service and Container Names

Use exactly these service/component names unless the user explicitly changes the SPECs:

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

Do not use alternative names such as `PointService`, `StatsService`, `PaymentService`, `ProviderSyncService`, or `APIService` in final code/diagrams unless they are purely internal class names and do not conflict with the canonical architecture.

---

## 6. Canonical Roles

Use exactly these roles:

```text
EV_USER
PROVIDER_ADMIN
OPERATOR
```

Role behavior:

- `EV_USER`: can search points, view point details, check status, reserve points, and view own reservations.
- `PROVIDER_ADMIN`: can view own provider analytics, own points, own invoices, pay issued invoices, export own logs, and manage limited provider settings.
- `OPERATOR`: can view global analytics, manage providers, trigger sync, edit pricing rules, issue invoices, and inspect system status.

Provider Admins are always scoped to their own provider.

---

## 7. Canonical Provider Codes

Use exactly:

```text
redPlug
greenPlug
bluePlug
```

Provider services:

- `red-provider-service` handles `redPlug`.
- `green-provider-service` handles `greenPlug`.
- `blue-provider-service` handles `bluePlug`.

Provider adapters must use the actual provider OpenAPI YAML files. Do not guess endpoint names or field names.

---

## 8. Canonical Internal Status Values

Normalize provider-specific status values to:

```text
available
charging
reserved
malfunction
offline
unknown
```

Missing, invalid, unmapped, or unavailable status values must map to `unknown`.

---

## 9. Accepted Architecture Summary

The accepted architecture is a Dockerized microservices SaaS application:

- React + TypeScript + Vite frontend.
- Python FastAPI backend services.
- Nginx gateway/reverse proxy.
- RabbitMQ topic exchange for asynchronous internal events.
- Separate PostgreSQL container per stateful service.
- REST/JSON internal APIs.
- Pydantic schemas.
- SQLAlchemy or SQLModel with Alembic migrations.
- PlantUML final diagrams.

The frontend calls only gateway routes. It must never call internal service ports or external provider APIs directly.

---

## 10. Data Ownership Rules

Each stateful service owns exactly one PostgreSQL container:

| Service | Database container |
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

Rules:

- No cross-service SQL joins.
- No service writes to another service's database.
- No shared mutable database tables.
- Use logical IDs and event-driven projections/read models where needed.
- Controlled duplication is allowed only as snapshot/projection data.
- MongoDB is not used for the MVP unless the user explicitly revisits that decision.

---

## 11. Provider Data Strategy

Use a hybrid provider strategy:

- Provider catalog/list data is fetched periodically and stored locally.
- Each provider service stores provider-local snapshots and raw payloads.
- `catalog-service` stores the aggregated normalized catalog.
- Search/map/point details read from the local aggregated catalog.
- Status uses `status-service` with 5-minute cache.
- Reservation uses synchronous provider API call through `reservation-service` and the relevant provider service.

Do not fetch all provider points on every user search or map movement.

---

## 12. Map Loading Rule

The map must use viewport/bounds-based loading.

Expected pattern:

```text
GET /api/catalog/points?minLat=...&maxLat=...&minLng=...&maxLng=...&zoom=...
```

Do not implement a normal map flow that loads all points at once.

---

## 13. Point Details Rule

Point details are read from the cached/local aggregated catalog through `catalog-service`.

Optional status lookup is performed separately through `status-service`.

Do not call provider detail APIs directly in the normal point-click UI path unless explicitly implementing a controlled fallback or background enrichment flow.

---

## 14. Reservation Rule

Reservations are synchronous and must not be queued before the provider call.

Accepted flow:

```text
frontend -> nginx-gateway -> reservation-service -> provider service -> external provider API
```

After the provider call returns, store the reservation record and publish reservation events for analytics and billing.

Do not implement:

```text
frontend -> reservation queue -> provider call
```

---

## 15. RabbitMQ and Event Rules

Use RabbitMQ only for asynchronous propagation:

- provider sync,
- provider snapshot readiness,
- catalog import events,
- analytics aggregation,
- billing charge creation,
- invoice/payment notifications.

Do not use RabbitMQ for:

- login,
- map search,
- point details,
- status lookup,
- reservation provider call,
- live frontend actions.

Use one topic exchange:

```text
saasplug.events
```

All events must use a common envelope:

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

Delivery is at-least-once. Consumers must be idempotent.

Use simple dead-letter queues for failed event handling.

---

## 16. No Dedicated Orchestrator

Do not create a dedicated orchestrator service.

Use:

- local orchestration inside the responsible service,
- event choreography for background propagation,
- no distributed transactions,
- no Saga implementation for the MVP.

---

## 17. Analytics Rules

`analytics-service` owns:

- raw usage events,
- hourly and daily aggregate tables,
- provider analytics,
- operator analytics,
- CSV exports,
- dashboard freshness indicators.

Dashboards must read precomputed aggregate/cache tables, not live cross-service joins.

Analytics must consume events from RabbitMQ and remain able to display already computed metrics even if `reservation-service` is unavailable.

Analytics must not call provider APIs.

---

## 18. Billing Rules

`billing-service` owns pricing, charges, invoices, invoice lines, and mock payments.

Accepted billing behavior:

- global default pricing rules,
- provider-specific pricing overrides,
- successful reservation fee,
- optional point view fee,
- failed reservations not charged by default,
- operator-only invoice issuance,
- provider admin can view and pay issued invoices,
- provider admin may request invoice issuance if implemented,
- mock payment only,
- full invoice payment only,
- no real payment gateway,
- no refunds,
- no partial payments,
- no tax/accounting compliance beyond simple display fields if needed.

Billing is eventually consistent and remains the financial source of truth.

---

## 19. Authentication and Authorization Rules

`auth-service` supports:

- Google OAuth login,
- email/password login,
- JWT access tokens,
- refresh tokens,
- role checks,
- provider-admin scoping.

Seed demo users:

```text
operator@saasplug.local
evuser@saasplug.local
red-admin@saasplug.local
green-admin@saasplug.local
blue-admin@saasplug.local
```

Never store plaintext passwords.

---

## 20. Frontend Rules

The frontend is one role-based React/Vite app.

Required UI areas:

- public/auth pages,
- EV user map/search/details/reservations,
- provider admin dashboard/analytics/invoices/export/settings,
- operator dashboard/providers/pricing/sync/invoices/system pages.

Provider Admins cannot issue invoices.

Operator can issue invoices and edit pricing rules.

All frontend API calls go through `/api/...` gateway routes.

---

## 21. Repository Structure Requirements

Target major folders:

```text
apps/
services/
packages/
deploy/
docs/
scripts/
```

Final diagrams go under:

```text
docs/diagrams/final/
```

Final specifications go under:

```text
docs/specs/SPECIFICATIONS.md
```

AI logs go under:

```text
docs/ai/
```

---

## 22. README Requirements

Every major folder, app, service, package, docs folder, deploy folder, and scripts folder must contain a `README.md`.

Required README files include at least:

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

Each README should explain purpose, important files, commands where relevant, dependencies, and relation to architecture.

---

## 23. Documentation and UML Rules

Final UML diagrams must be PlantUML files under:

```text
docs/diagrams/final/
```

Final diagrams must be consistent with code and accepted service names.

Required diagram types:

- use case,
- activity,
- class/data/DTO,
- API/interface,
- component,
- deployment,
- sequence,
- ER/persistence/data ownership.

Deployment diagrams must include ports and Docker containers.

Component diagrams must reference repository paths once implementation files exist.

---

## 24. GitHub Project Management Rule

Codex should attempt direct GitHub project/issue/milestone/label creation or update only if the environment has GitHub CLI/API permissions.

If it fails, Codex must clearly report:

- what it tried,
- why it failed if known,
- what the user must do manually.

Codex must not generate fallback Markdown project-management plans unless explicitly requested.

---

## 25. AI Documentation Rule

Because the official AI logs subsystem is unavailable, each Codex run must create or update repository-based AI documentation under:

```text
docs/ai/
```

Each run log should include:

- prompt received,
- goal,
- implementation summary,
- files changed,
- tests run,
- results,
- limitations,
- manual review notes where available.

Exact ChatGPT/Codex answers are captured only when explicitly provided or when Codex writes its own run report.

---

## AI Run Logging Policy

Every Codex run must update both of these repository-based AI logging artifacts unless the current prompt explicitly forbids repository writes:

```text
docs/ai/prompt-log.md
docs/ai/codex-runs/<run-id>-<run-name>.md
```

Run reports must distinguish between:

- **Invocation Prompt**: the exact text pasted into Codex by the user for that run.
- **Canonical Task Prompt**: a version-controlled prompt file under `docs/ai/prompts/`, when the run is invoked from one.

When a canonical task prompt is used, the run report must record the invocation prompt, the canonical prompt file path, and the full canonical prompt content where practical. If the full canonical prompt content is not copied into the run report, the report must record the file path and explain why.

Direct one-off prompts without a corresponding prompt file must be recorded as direct invocation prompts in both the run report and `docs/ai/prompt-log.md`.

---

## 26. Testing Rules

At minimum, implement and maintain tests for:

- provider normalization,
- catalog bounds query,
- status cache behavior,
- reservation success/failure normalization,
- analytics event idempotency,
- billing event idempotency,
- auth login/JWT/roles,
- basic service health endpoints.

Every Codex run that changes code should run relevant tests or clearly state why tests were not run.

---

## 27. Codex Behavior Rules

For every task, Codex must:

1. Read this file and relevant SPEC sections.
2. Restate the target scope briefly in its run report.
3. Avoid unrelated file changes.
4. Preserve canonical names.
5. Update README files if creating or materially changing a folder/service/package.
6. Add or update tests where practical.
7. Run relevant tests where practical.
8. Update `docs/ai/` run logs.
9. Report failures honestly.
10. Stop and ask/report if a requested change conflicts with accepted SPECs.

---

## 28. Current Accepted SPEC Registry

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
