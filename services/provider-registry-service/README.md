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

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not manage
providers, validate authorization, connect to `provider-registry-postgres`, or
call provider services.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/provider-registry/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
