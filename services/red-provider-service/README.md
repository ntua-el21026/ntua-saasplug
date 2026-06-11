# red-provider-service

## Responsibility

`red-provider-service` handles integration with the `redPlug` provider API and
normalizes `redPlug` payloads into internal DTOs.

## Owned database

`red-provider-postgres`

## Exposure

Internal-only. It is called by responsible backend services, not directly by
the frontend.

## Belongs here

- `redPlug` API adapter code.
- Provider-local snapshots and raw payload persistence.
- Provider-specific tests and migrations.

## Must not be placed here

- Generic catalog ownership.
- Frontend code.
- Provider APIs for `greenPlug` or `bluePlug`.
- Cross-service database access.

## Future implementation notes

Use `docs/assignment/providers/yaml/redPlug.yaml` as the source of truth for
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
the `redPlug` API, normalize provider payloads, connect to
`red-provider-postgres`, or publish events.

This service remains internal-only in the gateway baseline.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
