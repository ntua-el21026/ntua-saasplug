# saasPlug

saasPlug is the NTUA ECE Technologies of Software Services course project for
academic year 2025-2026. It is a Dockerized SaaS web application for EV
charging point discovery, reservation, provider analytics, billing, and
operator administration.

## Project Overview

saasPlug integrates three hypothetical charging infrastructure providers:

- `redPlug`
- `greenPlug`
- `bluePlug`

EV users search charging points, inspect cached details and live status, and
reserve charging points. Provider administrators inspect their own points,
analytics, invoices, mock payments, exports, and limited settings. Operators
manage providers, pricing, catalog imports, invoice issuance, event drains, and
system status.

## Architecture

The accepted MVP architecture is documented in
`docs/specs/SPECIFICATIONS.md` and summarized in
`docs/architecture-summary.md`.

The implemented repository follows this split:

- one role-based React + TypeScript + Vite frontend app,
- Nginx API gateway/reverse proxy on host port `8080`,
- Python FastAPI backend services,
- REST/JSON internal APIs,
- RabbitMQ topic exchange `saasplug.events` for asynchronous propagation,
- one PostgreSQL container per stateful service,
- final PlantUML diagrams under `docs/diagrams/final/`.

The frontend calls only `/api/...` gateway routes. It must not call
Docker-internal service ports, RabbitMQ, external provider APIs, or provider
service internals directly from the browser.

## Canonical Runtime Components

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
rabbitmq
```

## Data Ownership

Each stateful service owns exactly one PostgreSQL container.

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

Rules:

- no cross-service SQL joins,
- no shared mutable database tables,
- controlled duplication only as snapshots, projections, or cached views,
- provider services keep provider-local snapshots and raw payloads,
- `catalog-service` owns the aggregated normalized catalog,
- `reservation-service` owns reservation truth,
- `analytics-service` owns usage events and aggregate/cache tables,
- `billing-service` owns pricing, charges, invoices, and mock payments.

## Repository Layout

| Path | Purpose |
|---|---|
| `apps/frontend/` | Single role-based frontend app |
| `services/` | FastAPI microservices |
| `packages/events/` | Shared RabbitMQ event contracts and helpers |
| `packages/shared-contracts/` | Shared contract package placeholder |
| `packages/provider-normalization/` | Provider-normalization package placeholder |
| `deploy/nginx/` | Nginx gateway configuration |
| `docs/specs/` | Accepted project specifications |
| `docs/diagrams/final/` | Final PlantUML UML diagrams |
| `docs/assignment/` | Professor-provided assignment materials and provider YAML |
| `docs/lectures/` | Course lecture material |
| `docs/ai/` | Codex prompts, run reports, and prompt log |
| `scripts/` | Repository utility scripts |

## Local Runtime

Use `.env.example` as the safe local template. Do not commit a real `.env`.

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
```

Public entrypoints:

| Endpoint | Purpose |
|---|---|
| `http://localhost:8080/` | Frontend through Nginx |
| `http://localhost:8080/health` | Gateway health |
| `http://localhost:8080/api/auth/health` | `auth-service` health |
| `http://localhost:8080/api/providers/health` | `provider-registry-service` health |
| `http://localhost:8080/api/catalog/health` | `catalog-service` health |
| `http://localhost:8080/api/status/health` | `status-service` health |
| `http://localhost:8080/api/reservations/health` | `reservation-service` health |
| `http://localhost:8080/api/analytics/health` | `analytics-service` health |
| `http://localhost:8080/api/billing/health` | `billing-service` health |

Stop and remove local development volumes with:

```bash
docker compose down -v
```

The `-v` flag deletes local PostgreSQL and RabbitMQ volumes. Use it only when a
fresh local baseline is intended.

## Demo Users

The safe local demo password is controlled by `DEMO_USER_PASSWORD` in
`.env.example` and defaults to:

```text
change-me-demo-password
```

| Email | Role | Provider scope |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

Login through the gateway:

```bash
curl -X POST http://localhost:8080/api/auth/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@saasplug.local","password":"change-me-demo-password"}'
```

## Core Flows

- Login/register/logout use `auth-service` through `/api/auth/...`.
- EV map search uses viewport/bounds queries through
  `GET /api/catalog/points`.
- Point details read cached normalized catalog data through `catalog-service`.
- Live status lookup goes through `status-service`, which uses a 5-minute cache
  and falls back to last known cached status on provider timeout/error.
- Reservations are synchronous:
  `frontend -> nginx-gateway -> reservation-service -> provider service`.
- Successful/failed reservation events are staged in an outbox and published to
  RabbitMQ for analytics and billing propagation.
- Analytics dashboards read precomputed aggregate/cache tables.
- Billing owns pricing, charges, invoices, and mock full-invoice payments.

## Validation

Prompt 14 recorded the final verification in:

```text
docs/final-verification.md
```

The final verification includes frontend tests/build, shared event package
tests, Docker Compose config/startup/health checks, authenticated gateway smoke
checks, static forbidden-pattern checks, and Docker shutdown validation.

## Submission Artifacts

Primary final artifacts:

- `docs/architecture-summary.md`
- `docs/final-verification.md`
- `docs/submission-checklist.md`
- `docs/diagrams/final/`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`

## References

- Repository instructions: `AGENTS.md`
- Accepted specifications: `docs/specs/SPECIFICATIONS.md`
- Frontend documentation: `apps/frontend/README.md`
- Services documentation: `services/README.md`
- Deployment documentation: `deploy/README.md`
- Final diagrams: `docs/diagrams/final/README.md`
