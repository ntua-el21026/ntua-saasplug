# provider-registry-service

## Responsibility

`provider-registry-service` owns provider registration metadata, provider
enablement state, operator provider-management actions, and provider settings
that are not owned by provider-specific services.

## Owned database

`provider-registry-postgres`

## Exposure

Public through `nginx-gateway` for authorized operator and provider-admin
provider-management routes under `/api/providers/...`.

## Belongs here

- Provider registry FastAPI implementation.
- Provider metadata and settings persistence.
- Provider-management tests and migrations.

## Must not be placed here

- Provider-specific OpenAPI adapters.
- Normalized catalog ownership.
- Analytics, billing, or reservation truth.

## Future implementation notes

Provider admins must only access their own provider scope. Operators may manage
all providers.

Application logic is not implemented in this scaffold.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
