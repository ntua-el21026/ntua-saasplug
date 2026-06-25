# saasPlug

saasPlug is a Dockerized NTUA ECE course SaaS app for EV charging-point
search, live status lookup, reservation, provider analytics, billing, and
operator administration.

## Implemented Scope

- EV users can register, log in, search charging points on a MapLibre map, view
  current status, reserve a point, and inspect reservation summaries.
- Provider admins can inspect their provider's catalog, analytics, invoices,
  exports, pricing, and settings.
- Operators can manage providers, pricing, catalog imports, invoices, scheduler
  jobs, event drains, and system health.
- `redPlug`, `greenPlug`, and `bluePlug` are integrated through internal
  provider-adapter services.

## Architecture

The local runtime is defined by `docker-compose.yml`:

- one React + TypeScript + Vite frontend, built as static assets and served by
  Nginx inside the `frontend` container;
- one public `nginx-gateway` on `${GATEWAY_HTTP_PORT:-8080}`;
- Python FastAPI backend services on Docker-internal port `8000`;
- one PostgreSQL container per stateful service;
- RabbitMQ topic exchange `saasplug.events` for implemented asynchronous
  propagation;
- scheduler-controlled internal jobs for imports, event drains, outbox
  publishing, invoice preparation, and aggregate refresh.

The browser calls only gateway-relative `/api/...` paths. Provider adapters,
service-owned internal job endpoints, PostgreSQL, and AMQP are Docker-internal.

## Runtime Inventory

| Compose service | Purpose | Owned database |
|---|---|---|
| `frontend` | Role-based browser UI | none |
| `nginx-gateway` | Public frontend/API reverse proxy | none |
| `auth-service` | Users, local auth, Google OAuth, JWT/refresh tokens | `auth-postgres` |
| `provider-registry-service` | Provider metadata and audit logs | `provider-registry-postgres` |
| `red-provider-service` | Internal redPlug adapter and snapshot store | `red-provider-postgres` |
| `green-provider-service` | Internal greenPlug adapter and snapshot store | `green-provider-postgres` |
| `blue-provider-service` | Internal bluePlug adapter and snapshot store | `blue-provider-postgres` |
| `catalog-service` | Aggregated catalog, search, imports, point views | `catalog-postgres` |
| `status-service` | Status cache, live lookup, logs, fallback | `status-postgres` |
| `reservation-service` | Reservation truth, idempotency, provider mutation, outbox | `reservation-postgres` |
| `analytics-service` | Event ingestion, aggregates, dashboards, CSV export | `analytics-postgres` |
| `billing-service` | Pricing, charges, invoices, mock payments, billing outbox | `billing-postgres` |
| `scheduler-service` | Job metadata, manual runs, ordered maintenance | `scheduler-postgres` |
| `rabbitmq` | Event exchange and queues | RabbitMQ volume |

## Gateway Paths

| Prefix | Target |
|---|---|
| `/` | `frontend` |
| `/api/auth/*` | `auth-service`; auth routes are exposed as `/api/auth/auth/*` |
| `/api/providers/*`, `/api/provider-registry/*` | `provider-registry-service` |
| `/api/catalog/*` | `catalog-service` |
| `/api/status/*` | `status-service` |
| `/api/reservations/*` | `reservation-service` |
| `/api/analytics/*` | `analytics-service` |
| `/api/billing/*` | `billing-service` |
| `/api/scheduler/*` | `scheduler-service` |

## Local Setup

Use `.env.example` as the safe template. Do not commit a real `.env` and do
not print local secret values in reports.

```bash
cp .env.example .env
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

Default local entrypoints:

- frontend and gateway: `http://localhost:8080/`
- gateway health: `http://localhost:8080/health`
- service health through gateway: `/api/<service-prefix>/health`
- RabbitMQ management UI: `http://localhost:15672/`, bound to localhost by
  default

Stop the stack with:

```bash
docker compose down
```

Use `docker compose down -v` only when intentionally deleting local PostgreSQL
and RabbitMQ volumes.

## Demo Accounts

`auth-service` seeds demo accounts from server-side environment values.

| Email | Role | Provider scope |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

## Common Commands

Frontend:

```bash
cd apps/frontend
npm test -- --run
npm run build
```

Backend service tests:

```bash
docker compose run --build --rm --no-deps auth-service pytest -q
docker compose run --build --rm --no-deps catalog-service pytest -q
docker compose run --build --rm --no-deps status-service pytest -q
docker compose run --build --rm --no-deps reservation-service pytest -q
docker compose run --build --rm --no-deps analytics-service pytest -q
docker compose run --build --rm --no-deps billing-service pytest -q
docker compose run --build --rm --no-deps scheduler-service pytest -q
```

Shared event package:

```bash
PYTHONPATH=packages/events python -m pytest packages/events/tests -q
```

Repository checks:

```bash
scripts/lint/run-all.sh
scripts/lint/run-markdown.sh
docker compose config --quiet
```

Postman/Newman suites are documented in `docs/postman/README.md` and
`scripts/postman/README.md`.

## Documentation Map

| Path | Purpose |
|---|---|
| `docs/specs/SPECIFICATIONS.md` | Accepted project specification |
| `docs/architecture-summary.md` | Architecture summary and MVP boundaries |
| `docs/diagrams/final/saasplug-final-uml.md` | Self-contained final UML model |
| `docs/diagrams/final/diagram-audit.md` | Final diagram audit and correction notes |
| `docs/final-verification.md` | Verification history and latest evidence |
| `docs/submission-checklist.md` | Submission checklist |
| `docs/postman/` | Local Postman/Newman collections and data |
| `docs/assignment/` | Professor-provided assignment and provider materials |
| `docs/ai/` | Prompt log and Codex run reports |

## Submission Notes

- Submit source and documentation, not local `.env` files or generated
  reports.
- Generated PlantUML PNG/SVG outputs and Newman reports are not committed.
- Final UML sources are in `docs/diagrams/final/`; the grader-facing Markdown
  entrypoint is `docs/diagrams/final/saasplug-final-uml.md`.
- The current verification record is `docs/final-verification.md`.
