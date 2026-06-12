# event-contracts

## Purpose

This folder is a historical foundation placeholder for RabbitMQ event
contracts.

The active Prompt 09 implementation is:

```text
packages/events/
```

Use `packages/events` for the shared Python event envelope, routing,
topology, publisher, consumer, idempotency helpers, and tests.

## Belongs here

- Event envelope definitions.
- Event type names and versioning rules.
- Routing-key constants and contract tests.

## Must not be placed here

- RabbitMQ broker runtime configuration.
- Service-specific event handlers.
- Synchronous request/response API code.
- Business logic owned by one service.

No runtime code is implemented in this placeholder.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
