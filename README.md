# saasPlug

saasPlug is a Dockerized NTUA ECE course SaaS app for EV charging-point
search, live status lookup, reservation, provider analytics, billing, and
operator administration.

This repository records an **AI-assisted coursework prototype**. Start with
[architecture](docs/architecture-summary.md), [accepted specifications](docs/specs/SPECIFICATIONS.md),
[test guidance](tests/README.md), and the [AI prompt/run record](docs/ai/README.md).
The source demonstrates service boundaries and workflows; deployment acceptance
and public-portfolio rights are separate decisions.

The November 2026 local preparation removed private values from the legacy
`.env.example.correct` alias, retained mock-compatible local placeholders, bound
the public gateway to loopback, and made automatic provider activity opt-in in
the example/Compose configuration. Previously committed or deleted configuration
(including historical `present.txt`) remains an **owner rotation/revocation
follow-up**. Local edits do not remove Git history or verify revocation.

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
docker compose --env-file .env config --quiet
docker compose up -d --build
docker compose ps
```

The template starts without automatic scheduler jobs or startup catalog imports.
For a provider-connected demonstration, explicitly authorize/configure the course
provider keys, set `SCHEDULER_RUN_LOOP=true` and/or
`CATALOG_IMPORT_ON_STARTUP=true`, and review the existing operator import controls.
No external provider service was contacted during this preparation. With an empty
catalog, map results remain empty until data is deliberately imported.

Placeholder authentication and fixed local DB/broker credentials are retained for
isolated mocks. For a shared demonstration, use distinct private credentials,
`APP_ENV=demo` or `SAASPLUG_STRICT_SECRETS=true`, and update connection URLs
consistently. The strict mode rejects placeholder auth/internal secrets, but is
not a production security certification. Environment changes do not rotate
accounts in existing database or broker volumes.

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
| `docs/assignment/` | Internal course/provider source materials; redistribution rights require review |
| `docs/ai/` | Prompt log and Codex run reports |

## Submission Notes

- Submit source and documentation, not local `.env` files or generated
  reports.
- Generated PlantUML PNG/SVG outputs and Newman reports are not committed.
- Final UML sources are in `docs/diagrams/final/`; the grader-facing Markdown
  entrypoint is `docs/diagrams/final/saasplug-final-uml.md`.
- The current verification record is `docs/final-verification.md`.

## Local validation and remaining limits

Fresh November 2026 checks: 55 frontend tests passed and the TypeScript/Vite
production build passed; three offline template/network checks passed. Root
unittest discovery explicitly skips three live gateway contract tests unless
`SAASPLUG_RUN_GATEWAY_TESTS=1` is set for an already running, isolated local stack.
Compose schema validation passed; Docker Desktop's Linux daemon was unavailable,
so the stack, broker, PostgreSQL, and live provider workflows were not executed.

The existing auth service's pinned dependencies could not resolve on Python 3.14
because `psycopg-binary==3.2.3` has no compatible wheel. The supported Python 3.12
runtime was used for a separate offline auth validation; see the
[preparation run record](docs/ai/codex-runs/20261112-local-portfolio-preparation.md)
for the actual outcome. Pins were preserved. Historical verification reports
remain historical evidence and do not override these fresh execution limits.

## Authorship and reuse

The root [MIT license](LICENSE) names Michail-Athanasios Peppas. Extensive Codex
assistance is recorded in [the AI log](docs/ai/README.md); code volume and run
counts do not establish independent manual authorship or production use.
Any contributor responsibilities beyond the recorded evidence still require
confirmation. Professor/provider materials, lecture files, screenshots, third-party
packages, and prompts discussing private configuration retain their own rights
and privacy constraints. They remain available for internal traceability; their
presence here is not a blanket redistribution grant. Public presentation should
lead with the implementation, architecture, tests, and the disclosed AI workflow.
