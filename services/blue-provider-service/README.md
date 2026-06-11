# blue-provider-service

## Responsibility

`blue-provider-service` handles integration with the `bluePlug` provider API
and normalizes `bluePlug` payloads into internal DTOs.

## Owned database

`blue-provider-postgres`

## Exposure

Internal-only. It is called by responsible backend services, not directly by
the frontend.

## Belongs here

- `bluePlug` API adapter code.
- Provider-local snapshots and raw payload persistence.
- Provider-specific tests and migrations.

## Must not be placed here

- Generic catalog ownership.
- Frontend code.
- Provider APIs for `redPlug` or `greenPlug`.
- Cross-service database access.

## Future implementation notes

Use `docs/assignment/providers/yaml/bluePlug.yaml` as the source of truth for
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
the `bluePlug` API, normalize provider payloads, connect to
`blue-provider-postgres`, or publish events.

This service remains internal-only in the gateway baseline.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
