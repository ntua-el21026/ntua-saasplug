# saasPlug

saasPlug is the NTUA ECE Technologies of Software Services course project for
academic year 2025-2026. It is a SaaS web application for EV charging point
discovery, reservation, provider analytics, billing, and operator
administration.

> Prompt 02 baseline status: Docker Compose, Nginx gateway, service
> containers, database containers, RabbitMQ, and health endpoints are present.
> Prompt 03 auth status: `auth-service` has local persistence, seeded demo
> users, email/password login, JWT access tokens, refresh tokens, role/provider
> scope helpers, and safe Google OAuth hook endpoints.
> Prompt 04 provider-registry status: `provider-registry-service` has local
> persistence, seeded canonical providers, role/provider-scoped JWT
> authorization, safe integration configuration metadata, and provider config
> audit logs. Provider adapters and external provider calls are not implemented
> yet.

## Project Overview

saasPlug integrates three hypothetical charging infrastructure providers:

- `redPlug`
- `greenPlug`
- `bluePlug`

EV users search for charging points, inspect status, and reserve chargers.
Provider administrators inspect their own points, analytics, invoices, payment
state, exports, and limited settings. Operators manage providers, pricing,
sync, invoices, and system status.

## Architecture Summary

The accepted MVP architecture is a Dockerized microservices application:

- one React + TypeScript + Vite frontend app,
- an Nginx API gateway/reverse proxy,
- Python FastAPI backend services,
- REST/JSON internal APIs,
- RabbitMQ topic exchange `saasplug.events` for asynchronous propagation,
- one PostgreSQL container per stateful service,
- PlantUML diagrams for final documentation.

Frontend code must call only `/api/...` gateway routes. It must not call
internal service ports or provider APIs directly.

## Canonical Services

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

## Canonical Database Containers

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

## Repository Layout

| Path | Purpose |
|---|---|
| `apps/` | User-facing applications |
| `services/` | FastAPI microservices |
| `packages/` | Shared contracts and helper packages |
| `deploy/` | Deployment and gateway files |
| `docs/` | Specifications, diagrams, assignment material, AI logs |
| `scripts/` | Repository utility scripts |

## Local Development Baseline

Use `.env.example` as the safe configuration template. Do not commit a real
`.env` file.

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
```

Expected baseline health checks:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/provider-registry/health
curl http://localhost:8080/api/providers/health
curl http://localhost:8080/api/catalog/health
curl http://localhost:8080/api/reservations/health
```

Auth-service local demo endpoints are available through the gateway under
`/api/auth/auth/...` because the gateway maps `/api/auth/` to the service root:

```bash
curl -X POST http://localhost:8080/api/auth/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@saasplug.local","password":"change-me-demo-password"}'

curl http://localhost:8080/api/auth/auth/me \
  -H "Authorization: Bearer <access-token>"
```

The local demo users are:

| Email | Role | Provider scope |
|---|---|---|
| `operator@saasplug.local` | `OPERATOR` | none |
| `evuser@saasplug.local` | `EV_USER` | none |
| `red-admin@saasplug.local` | `PROVIDER_ADMIN` | `redPlug` |
| `green-admin@saasplug.local` | `PROVIDER_ADMIN` | `greenPlug` |
| `blue-admin@saasplug.local` | `PROVIDER_ADMIN` | `bluePlug` |

The safe local demo password is controlled by `DEMO_USER_PASSWORD` in
`.env.example`. Change it in your uncommitted `.env` for local use.

Provider-registry endpoints are available through the gateway under
`/api/providers/providers...` because the gateway maps `/api/providers/` to the
service root:

```bash
curl http://localhost:8080/api/providers/providers \
  -H "Authorization: Bearer <access-token>"

curl http://localhost:8080/api/providers/providers/redPlug/integration-config \
  -H "Authorization: Bearer <access-token>"
```

Stop the baseline and remove local development volumes with:

```bash
docker compose down -v
```

The `-v` flag deletes local PostgreSQL and RabbitMQ volumes. Use it only when a
fresh local baseline is intended.

## Prompt 02 Scope

Implemented:

- `docker-compose.yml` with canonical container names.
- Nginx gateway on host port `8080`.
- RabbitMQ with management UI on host port `15672`.
- One PostgreSQL container per stateful service, using named volumes.
- Minimal FastAPI `/`, `/health`, and `/ready` endpoints for each backend
  service.
- Minimal Vite frontend placeholder on internal port `5173`.

Still not implemented by Prompt 02:

- provider adapters or provider API calls,
- catalog sync, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, schemas, migrations, seed data, or frontend product
  screens.

## Prompt 03 Scope

Implemented:

- `auth-service` local table creation for MVP development.
- Hashed password storage.
- Idempotent seeded demo users.
- JSON email/password register and login.
- JWT access tokens with `sub`, `email`, `roles`, `provider_id`,
  `provider_code`, and `exp`.
- Hashed persisted refresh tokens with logout revocation.
- `/auth/me`, `/auth/require-operator`, and
  `/auth/require-provider-admin` verification endpoints.
- Safe Google OAuth login/callback hooks that return clear local-demo JSON when
  credentials are placeholders.

Not implemented yet:

- frontend login screens,
- real Google token exchange,
- provider-registry business logic,
- provider adapters or provider API calls,
- catalog sync, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, or frontend product screens.

Prompt 04 implements the `provider-registry-service` baseline described below.

## Prompt 04 Scope

Implemented:

- `provider-registry-service` local table creation for MVP development.
- Idempotent seed data for `redPlug`, `greenPlug`, and `bluePlug`.
- Provider metadata, activation status, safe integration-config, and audit-log
  JSON endpoints.
- JWT bearer authorization using `auth-service` token claims and shared
  `JWT_SECRET`.
- Operator access for all providers and provider-admin access scoped to the
  provider in the token.
- Safe secret handling that stores and returns only environment-variable names,
  never raw provider API keys.

Still not implemented:

- provider adapters or external provider API calls,
- provider-local charging-point snapshots,
- catalog sync/search, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, or frontend product screens.

The next implementation prompt is Prompt 05 for provider services.

## Canonical References

- Repository instructions: `AGENTS.md`
- Accepted specifications: `docs/specs/SPECIFICATIONS.md`
- Final diagrams: `docs/diagrams/final/`
- AI prompt log: `docs/ai/prompt-log.md`

Follow `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` before changing source,
runtime, documentation, or diagrams.
