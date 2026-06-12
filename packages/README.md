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

## Current packages

| Path | Purpose |
|---|---|
| `packages/shared-contracts/` | Placeholder for shared DTO/API contracts |
| `packages/provider-normalization/` | Placeholder for provider-normalization helpers |
| `packages/event-contracts/` | Historical placeholder for event contracts |
| `packages/events/` | Active Python package for RabbitMQ event envelope, routing, topology, publisher, consumer, and idempotency helpers |

`packages/events` is the active Prompt 09 implementation because the Prompt 09
canonical task file requested that package path. The older
`packages/event-contracts` folder remains as a first-foundation placeholder and
does not contain runtime code.

## Must not be placed here

- Service-owned business logic.
- Database models owned by one service.
- Frontend screens.
- Docker runtime files.
- Real secrets.

## Tests

```bash
PYTHONPATH=packages/events python -m pytest packages/events/tests -q -s
```

The `-s` flag avoids a local Python 3.14 pytest capture issue seen in this
workspace. Docker-based validation can also run the same package tests from the
reservation-service image.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
