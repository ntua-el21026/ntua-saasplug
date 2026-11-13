# saasPlug

saasPlug is a Dockerized NTUA ECE course SaaS app for EV charging-point
search, cached/provider-backed status lookup, reservations, provider analytics,
billing, and operator administration.

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

## Demonstration flow

With an owned local stack and deliberately configured provider connectivity:

1. As an operator, import provider catalogs and inspect sync results.
2. As an EV user, search the map/list, open a point, inspect status/freshness,
   and submit a reservation with an idempotency key.
3. Review the reservation result/history. An ambiguous provider result is stored
   as `unknown`; inspect history before starting another mutation.
4. As operator, run the ordered maintenance sequence so reservation outbox,
   billing consumption/outbox, and analytics consumption/aggregation progress.
5. As the provider's admin, inspect scoped usage metrics and CSV exports. As
   operator, issue an invoice; as provider admin, record a full mock payment.

Reservations call the provider adapter synchronously; RabbitMQ carries later
analytics/billing propagation. Dashboards can therefore lag reservation state.
The provider `Tracked revenue` field estimates charging revenue from reservation
snapshots. SaaS charges/invoices are separate billing records. Neither estimated
EV costs nor mock invoice payments represent money transferred to a provider.

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

## Prerequisites and external integration

Use Docker Engine with Compose v2 and capacity for the containers in the
runtime inventory.
Dockerfiles target Python 3.12 backend images and a Node 20 frontend build.
Host Python 3 is sufficient for the offline repository configuration checks;
host Node/npm is needed only for frontend development. Preserve the existing
service requirement pins and npm lockfile.

| Dependency | Configuration / availability |
|---|---|
| Course provider APIs | `RED_PROVIDER_BASE_URL`, `GREEN_PROVIDER_BASE_URL`, `BLUE_PROVIDER_BASE_URL` and matching `*_PROVIDER_API_KEY` values; access to the NTUA course network/VPN and authorized keys is required |
| Google OAuth | Optional real integration: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_FRONTEND_CALLBACK_URI`; placeholder mode has a local EV demo sign-in path |
| Map background | Browser fetches public OpenFreeMap style/tiles; internet access is required for the background map |
| PostgreSQL/RabbitMQ | Compose-managed state; no hosted database/broker subscription is required |
| Billing | Internal mock payment records only; no card/bank/payment-provider credentials |

The three providers are hypothetical course integrations. Their committed
[OpenAPI/Postman artifacts](docs/assignment/providers/README.md) support source
inspection when course services are unavailable; they do not include a complete
local provider simulator or make a reservation demo work without connectivity.
Keep restricted provider/course materials under their original rights. Do not
retrieve or publish credentials or private source data.

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

`auth-service` seeds demo accounts from `DEMO_USER_PASSWORD`. The current Compose
build also passes that value to frontend `VITE_DEMO_LOGIN_PASSWORD` for demo
prefill: it is browser-visible, not a secret boundary. Use only disposable demo
credentials with this runtime. Changing the variable does not reset existing
accounts unless the deliberate reset behavior is enabled; never set a reused
personal or provider password.

| Email | Role | Provider scope |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

## Common Commands

Frontend (install the locked dependencies first):

```bash
cd apps/frontend
npm ci --ignore-scripts
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

## Troubleshooting

- **Empty map/list:** startup catalog import defaults to off. Check authorized
  provider connectivity and the operator import result; local source/tests do
  not supply a populated provider database.
- **Reservation outcome unknown:** inspect reservation history and attempt
  metadata before retrying with a new key. Provider timeouts are not proof that
  the external mutation failed.
- **Dashboards or invoices lag:** inspect job history/outbox state and the
  ordered maintenance sequence. With `SCHEDULER_RUN_LOOP=false`, these jobs need
  deliberate operator runs.
- **OAuth callback mismatch:** register the configured redirect URI exactly.
  The backend router gives real auth URLs the repeated `/api/auth/auth/` prefix.
- **Secret changes do not take effect in a database:** initialized volumes retain
  account state; environment edits alone do not rotate database/broker users.

## Local validation and remaining limits

For the 13 November 2026 documentation update,
`env -u SAASPLUG_RUN_GATEWAY_TESTS python3 -m unittest discover -s tests -v`
passed three offline configuration checks and skipped three opt-in live gateway
cases (0 failures, 0 errors). No stack was started.

Recorded 12 November 2026 preparation checks (frontend/build checks not rerun):
55 frontend tests passed and the TypeScript/Vite production build passed; three offline template/network checks passed. Root
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
