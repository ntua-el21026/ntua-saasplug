# saasPlug

saasPlug is the NTUA ECE Technologies of Software Services course project for
academic year 2025-2026. It is a SaaS web application for EV charging point
discovery, reservation, provider analytics, billing, and operator
administration.

> Prompt 02 baseline status: Docker Compose, Nginx gateway, service
> containers, database containers, RabbitMQ, and health endpoints are present.
> Business workflows are not implemented yet.

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
curl http://localhost:8080/api/catalog/health
curl http://localhost:8080/api/reservations/health
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

Not implemented yet:

- authentication, JWT, OAuth, or user flows,
- provider adapters or provider API calls,
- catalog sync, status cache, or reservation business flow,
- RabbitMQ business publishers or consumers,
- analytics, billing, schemas, migrations, seed data, or frontend product
  screens.

The next implementation prompt is Prompt 03 for `auth-service`.

## Canonical References

- Repository instructions: `AGENTS.md`
- Accepted specifications: `docs/specs/SPECIFICATIONS.md`
- Final diagrams: `docs/diagrams/final/`
- AI prompt log: `docs/ai/prompt-log.md`

Follow `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` before changing source,
runtime, documentation, or diagrams.
