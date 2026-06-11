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

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
