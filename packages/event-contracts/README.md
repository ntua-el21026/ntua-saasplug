# event-contracts

## Purpose

This package will hold RabbitMQ event envelope and routing contracts for
`saasplug.events`.

## Belongs here

- Event envelope definitions.
- Event type names and versioning rules.
- Routing-key constants and contract tests.

## Must not be placed here

- RabbitMQ broker runtime configuration.
- Service-specific event handlers.
- Synchronous request/response API code.
- Business logic owned by one service.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
