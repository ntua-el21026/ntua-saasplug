# Services

This folder contains the Python FastAPI microservices for saasPlug.

## Purpose

Each service owns a bounded responsibility and, when stateful, exactly one
PostgreSQL container.

## Belongs here

- Canonical FastAPI services listed in `AGENTS.md`.
- Service-local tests, migrations, README files, and implementation files added
  by later prompts.
- Service-specific configuration templates without secrets.

## Must not be placed here

- Frontend code.
- Shared package code that should live under `packages/`.
- Docker Compose runtime files.
- Cross-service database joins or shared mutable tables.
- Real secrets or `.env` files.

## Canonical services

```text
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
```

## Docker baseline

Prompt 02 adds a minimal FastAPI runtime scaffold for each canonical backend
service.

Each service exposes only:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata. They do not connect to
PostgreSQL, call provider APIs, publish RabbitMQ events, or implement business
logic.

Each service folder contains:

```text
Dockerfile
.dockerignore
requirements.txt
app/__init__.py
app/main.py
```

Run the full baseline from the repository root:

```bash
docker compose up -d --build
```

Do not expose backend service ports to the host. Access public service health
through the gateway, for example:

```bash
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/catalog/health
```

Application business logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
