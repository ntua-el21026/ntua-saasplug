# Packages

This folder contains shared packages used by saasPlug apps and services.

## Purpose

Shared packages keep cross-cutting contracts and helpers explicit without
creating shared mutable service state.

## Belongs here

- Shared DTO and API contracts.
- Provider normalization helpers.
- Event envelope and routing contracts.
- Package-local tests.

## Must not be placed here

- Service-owned business logic.
- Database models owned by one service.
- Frontend screens.
- Docker runtime files.
- Real secrets.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
