# saasPlug

saasPlug is the NTUA ECE Technologies of Software Services course project for
academic year 2025-2026. It is a SaaS web application for EV charging point
discovery, reservation, provider analytics, billing, and operator
administration.

> Prompt 01 foundation status: the repository structure and documentation
> scaffold are present, but the application is not fully implemented yet.

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

## Quick Start Placeholder

Full Docker runtime, service bootstrapping, and frontend implementation will be
added in later prompts. For now, use `.env.example` as the safe configuration
template and do not create or commit a real `.env` file with secrets.

```bash
cp .env.example .env
```

The command above is only a local preparation step for future runtime work.
There is no complete `docker compose up` workflow after Prompt 01.

## Canonical References

- Repository instructions: `AGENTS.md`
- Accepted specifications: `docs/specs/SPECIFICATIONS.md`
- Final diagrams: `docs/diagrams/final/`
- AI prompt log: `docs/ai/prompt-log.md`

Follow `AGENTS.md` and `docs/specs/SPECIFICATIONS.md` before changing source,
runtime, documentation, or diagrams.
