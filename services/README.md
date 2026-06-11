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

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
