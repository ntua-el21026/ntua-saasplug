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
scheduler-service
rabbitmq
```

## Data Ownership

Each stateful service owns exactly one PostgreSQL container.

| Service                     | Database container           |
| --------------------------- | ---------------------------- |
| `auth-service`              | `auth-postgres`              |
| `provider-registry-service` | `provider-registry-postgres` |
| `red-provider-service`      | `red-provider-postgres`      |
| `green-provider-service`    | `green-provider-postgres`    |
| `blue-provider-service`     | `blue-provider-postgres`     |
| `catalog-service`           | `catalog-postgres`           |
| `status-service`            | `status-postgres`            |
| `reservation-service`       | `reservation-postgres`       |
| `analytics-service`         | `analytics-postgres`         |
| `billing-service`           | `billing-postgres`           |
| `scheduler-service`         | `scheduler-postgres`         |

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

| Path                               | Purpose                                                   |
| ---------------------------------- | --------------------------------------------------------- |
| `apps/frontend/`                   | Single role-based frontend app                            |
| `services/`                        | FastAPI microservices                                     |
| `packages/events/`                 | Shared RabbitMQ event contracts and helpers               |
| `packages/shared-contracts/`       | Shared contract package placeholder                       |
| `packages/provider-normalization/` | Provider-normalization package placeholder                |
| `deploy/nginx/`                    | Nginx gateway configuration                               |
| `docs/specs/`                      | Accepted project specifications                           |
| `docs/diagrams/final/`             | Final PlantUML UML diagrams                               |
| `docs/assignment/`                 | Professor-provided assignment materials and provider YAML |
| `docs/lectures/`                   | Course lecture material                                   |
| `docs/ai/`                         | Codex prompts, run reports, and prompt log                |
| `scripts/`                         | Repository utility scripts                                |

## Local Runtime

Use `.env.example` as the safe local template. Do not commit a real `.env`.

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
```

Public entrypoints:

| Endpoint                                        | Purpose                            |
| ----------------------------------------------- | ---------------------------------- |
| `http://localhost:8080/`                        | Frontend through Nginx             |
| `http://localhost:8080/health`                  | Gateway health                     |
| `http://localhost:8080/api/auth/health`         | `auth-service` health              |
| `http://localhost:8080/api/providers/health`    | `provider-registry-service` health |
| `http://localhost:8080/api/catalog/health`      | `catalog-service` health           |
| `http://localhost:8080/api/status/health`       | `status-service` health            |
| `http://localhost:8080/api/reservations/health` | `reservation-service` health       |
| `http://localhost:8080/api/analytics/health`    | `analytics-service` health         |
| `http://localhost:8080/api/billing/health`      | `billing-service` health           |
| `http://localhost:8080/api/scheduler/health`    | `scheduler-service` health         |

Stop the local stack with:

```bash
docker compose down
```

Use `docker compose down -v` only when you intentionally want to delete local
PostgreSQL and RabbitMQ volumes and return to a fresh baseline.

## Demo Users

Demo users are seeded by `auth-service` from the server-side
`DEMO_USER_PASSWORD` environment variable. The frontend deliberately does not
receive, render, or prefill that password. For demos, the presenter should
provide the password out-of-band. The login role shortcuts fill the account
email and keep any password value the presenter has already typed in the
password field.

| Email                        | Role             | Provider scope |
| ---------------------------- | ---------------- | -------------- |
| `operator@saasplug.local`    | `OPERATOR`       | none           |
| `evuser@saasplug.local`      | `EV_USER`        | none           |
| `red-admin@saasplug.local`   | `PROVIDER_ADMIN` | `redPlug`      |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug`    |
| `blue-admin@saasplug.local`  | `PROVIDER_ADMIN` | `bluePlug`     |

Login through the gateway:

```bash
curl -X POST http://localhost:8080/api/auth/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@saasplug.local","password":"<demo-password>"}'
```

Startup inserts missing demo users by default but does not overwrite existing
demo-user roles, provider scopes, password hashes, or active flags. Use
`RESET_DEMO_USERS_ON_STARTUP=true` only when intentionally resetting local demo
accounts.

`.env.example` contains local placeholders only. Before any production-like or
public demo environment, rotate `DEMO_USER_PASSWORD`, `JWT_SECRET`, scheduler,
RabbitMQ, provider, OAuth, and database secrets and enable
`SAASPLUG_STRICT_SECRETS=true` or a production-like `APP_ENV` so unsafe
placeholders are rejected at startup. Rotate `JWT_SECRET` after any environment
where browser-delivered demo credentials may previously have been used.

## Provider API Integration

The three external provider APIs are represented by provider-specific internal
services:

| Provider    | Service                  | Source contract                                 |
| ----------- | ------------------------ | ----------------------------------------------- |
| `redPlug`   | `red-provider-service`   | `docs/assignment/providers/yaml/redPlug.yaml`   |
| `greenPlug` | `green-provider-service` | `docs/assignment/providers/yaml/greenPlug.yaml` |
| `bluePlug`  | `blue-provider-service`  | `docs/assignment/providers/yaml/bluePlug.yaml`  |

Provider services use provider credentials from the private local `.env`.
Credentials must not be committed. The live provider APIs use:

```text
Authorization: Bearer <api-key>
```

The default placeholder configuration is `PROVIDER_AUTH_SCHEME=Bearer` in
`.env.example`.

## Validation

The current final verification evidence is recorded in:

```text
docs/final-verification.md
```

The latest live-environment verification covered frontend tests/build, backend
service tests, scheduler tests, shared event package tests, root gateway
contract tests, Docker Compose config/startup/health checks, authenticated
gateway smoke checks, live provider read-only checks, scheduler manual-run
smoke checks, internal-route gateway blocking, PlantUML validation, and Docker
shutdown validation.

The verified test total is 184 tests across backend services, frontend, shared
event contracts, and root gateway contracts.

The 2026-06-24 safe-finalization pass added targeted regression coverage for
reservation idempotency/locking, provider-status scoping, catalog import locks,
catalog radius limits, billing payment duplication, provider CSV privacy,
demo-user seed preservation, strict placeholder rejection, and frontend
reservation idempotency headers. It also keeps RabbitMQ management bound to
`127.0.0.1:15672`.

Existing local Docker volumes that predate new database constraints or lock
tables may need recreation or service-local migrations for a fresh schema
baseline. Do not use `docker compose down -v` unless deleting local volumes is
intentional.

### Test commands

Run service-local tests through Docker Compose so each service uses its own
declared runtime dependencies:

```bash
docker compose run --build --rm --no-deps auth-service pytest -q
docker compose run --build --rm --no-deps provider-registry-service pytest -q
docker compose run --build --rm --no-deps red-provider-service pytest -q
docker compose run --build --rm --no-deps green-provider-service pytest -q
docker compose run --build --rm --no-deps blue-provider-service pytest -q
docker compose run --build --rm --no-deps catalog-service pytest -q
docker compose run --build --rm --no-deps status-service pytest -q
docker compose run --build --rm --no-deps reservation-service pytest -q
docker compose run --build --rm --no-deps analytics-service pytest -q
docker compose run --build --rm --no-deps billing-service pytest -q
docker compose run --build --rm --no-deps scheduler-service pytest -q
```

Run shared event package tests through a backend image that installs the package:

```bash
docker compose run --build --rm --no-deps analytics-service sh -lc 'cd /tmp/packages/events && pytest -q'
```

Run frontend tests and the production build:

```bash
docker compose run --build --rm --no-deps frontend npm test
docker compose run --build --rm --no-deps frontend npm run build
```

Run root gateway contract tests only after the stack is running:

```bash
docker compose up -d --build
python3 -m unittest discover tests -v
```

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
