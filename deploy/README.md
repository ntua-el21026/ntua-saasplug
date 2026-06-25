# Deploy

This folder contains deployment and gateway configuration for the local
Dockerized saasPlug runtime.

## Purpose

The MVP uses Docker Compose for local orchestration and Nginx as the single
browser-facing gateway. Compose starts the frontend, canonical backend
services, one PostgreSQL container per stateful service, and RabbitMQ.

## Contents

| Path | Purpose |
|---|---|
| `deploy/nginx/default.conf` | Nginx reverse-proxy routes for frontend and `/api/...` service prefixes |
| `deploy/nginx/README.md` | Gateway route documentation |
| `docker-compose.yml` | Local runtime topology at repository root |
| `.env.example` | Safe placeholder configuration at repository root |

## Public Ports

| Component | Host port | Purpose |
|---|---:|---|
| `nginx-gateway` | `${GATEWAY_HTTP_PORT:-8080}` | Frontend and public API gateway |
| `rabbitmq` | `${RABBITMQ_MANAGEMENT_PORT:-15672}` on `127.0.0.1` | RabbitMQ management UI for local inspection |

Backend services, frontend port `5173`, PostgreSQL containers, and RabbitMQ
AMQP port are Docker-internal for the MVP.

## Gateway Routes

```text
/                       -> frontend:5173
/health                 -> nginx-gateway health response
/api/auth/...           -> auth-service:8000
/api/providers/...      -> provider-registry-service:8000
/api/catalog/...        -> catalog-service:8000
/api/status/...         -> status-service:8000
/api/reservations/...   -> reservation-service:8000
/api/analytics/...      -> analytics-service:8000
/api/billing/...        -> billing-service:8000
/api/scheduler/...      -> scheduler-service:8000
```

Provider services are intentionally not exposed through Nginx. They remain
internal to provider sync, status lookup, and reservation flows.
Service-owned `/internal/jobs/...` endpoints are also not exposed through
Nginx; they are called only over the Docker network by `scheduler-service`.

## Commands

From the repository root:

```bash
cp .env.example .env
docker compose config
docker compose up -d --build
docker compose ps
```

Smoke checks:

```bash
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/auth/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/providers/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/catalog/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/status/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/reservations/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/analytics/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/billing/health"
curl "http://localhost:${GATEWAY_HTTP_PORT:-8080}/api/scheduler/health"
```

Stop and remove local volumes:

```bash
docker compose down -v
```

## Constraints

- Do not commit `.env` or real secrets.
- Do not expose backend service ports to the host.
- Do not add new runtime containers outside the accepted specifications without
  explicit approval.
- Keep `scheduler-service` as a control plane only; do not move live user
  actions into RabbitMQ or scheduler-owned business logic.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/diagrams/final/deployment.puml`
