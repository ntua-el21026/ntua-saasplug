# green-provider-service

## Responsibility

`green-provider-service` handles integration with the `greenPlug` provider API
and normalizes `greenPlug` payloads into internal DTOs.

## Owned database

`green-provider-postgres`

## Exposure

Internal-only. It is called by responsible backend services, not directly by
the frontend.

## Belongs here

- `greenPlug` API adapter code.
- Provider-local snapshots and raw payload persistence.
- Provider-specific tests and migrations.

## Must not be placed here

- Generic catalog ownership.
- Frontend code.
- Provider APIs for `redPlug` or `bluePlug`.
- Cross-service database access.

## Future implementation notes

Use `docs/assignment/providers/yaml/greenPlug.yaml` as the source of truth for
endpoint names and schemas.

Application logic is not implemented in this scaffold.

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not call
the `greenPlug` API, normalize provider payloads, connect to
`green-provider-postgres`, or publish events.

This service remains internal-only in the gateway baseline.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
