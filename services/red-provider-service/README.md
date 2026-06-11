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

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
