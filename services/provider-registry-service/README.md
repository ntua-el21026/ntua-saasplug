# provider-registry-service

## Responsibility

`provider-registry-service` owns provider registration metadata, provider
enablement state, operator provider-management actions, and provider settings
that are not owned by provider-specific services.

## Owned database

`provider-registry-postgres`

## Exposure

Public through `nginx-gateway` for authorized operator and provider-admin
provider-management routes under `/api/provider-registry/...` and
`/api/providers/...`.

## Belongs here

- Provider registry FastAPI implementation.
- Provider metadata and settings persistence.
- Provider API configuration metadata, without raw secret values.
- Provider config audit logs.
- Provider-management tests.

## Must not be placed here

- Provider-specific OpenAPI adapters.
- External provider API calls.
- Normalized catalog ownership.
- Analytics, billing, or reservation truth.

## Seeded providers

Startup seeding creates or updates the three canonical providers
idempotently:

| Provider code | Display name | API key environment variable |
|---|---|---|
| `redPlug` | `redPlug` | `RED_PROVIDER_API_KEY` |
| `greenPlug` | `greenPlug` | `GREEN_PROVIDER_API_KEY` |
| `bluePlug` | `bluePlug` | `BLUE_PROVIDER_API_KEY` |

Provider IDs are deterministic and match the demo provider-admin token scopes
seeded by `auth-service`.

## Owned tables

The service creates MVP development tables at startup, following the same
deterministic local style as `auth-service`:

| Table | Purpose |
|---|---|
| `providers` | Canonical provider metadata, activation status, and safe API configuration metadata |
| `provider_config_audit_logs` | Provider config/status create/update/seed audit records |

No service may write to `provider-registry-postgres` except
`provider-registry-service`.

## Authorization

All provider-management endpoints require a bearer JWT issued by
`auth-service`. The service validates the token locally with `JWT_SECRET` and
does not read `auth-postgres`.

Access rules:

- `OPERATOR` can list, read, create, update, and change activation status for
  any provider.
- `PROVIDER_ADMIN` can list/read only the provider in the JWT provider scope.
- `PROVIDER_ADMIN` can update only safe editable metadata for its own provider:
  `display_name`, `legal_name`, and `contact_email`.
- `EV_USER` cannot access provider-registry management endpoints.
- Unauthenticated access is limited to `/health` and `/ready`.

## Endpoint summary

The gateway routes `/api/provider-registry/` and `/api/providers/` to this
service. Because those gateway prefixes are stripped, service paths are:

```text
GET /
GET /health
GET /ready
GET /providers
GET /providers/{provider_code}
POST /providers
PATCH /providers/{provider_code}
PATCH /providers/{provider_code}/status
GET /providers/{provider_code}/integration-config
GET /providers/{provider_code}/audit-logs
```

Example gateway health smoke tests:

```bash
curl http://localhost:8080/api/provider-registry/health
curl http://localhost:8080/api/providers/health
```

Example authenticated gateway call:

```bash
curl http://localhost:8080/api/providers/providers \
  -H "Authorization: Bearer <access-token>"
```

## Safe secret handling

Provider API key values are not stored or returned. The registry stores only
safe metadata such as:

- provider API base URL;
- API auth type;
- auth header name;
- expected API key environment variable name;
- timeout setting;
- activation state.

Integration-config responses expose `api_key_env_var` and whether a secret is
expected to be configured elsewhere. They must not expose raw provider secrets.

## Local commands

Run the service tests in the container:

```bash
docker compose run --rm --no-deps provider-registry-service pytest -q
```

Run the Compose and gateway baseline:

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl http://localhost:8080/health
curl http://localhost:8080/api/provider-registry/health
curl http://localhost:8080/api/providers/health
docker compose down -v
```

The `-v` flag removes local development volumes and should only be used when a
fresh local baseline is intended.

## Limitations and deferred work

- Provider adapters and external provider API calls belong to provider-service
  implementation work.
- Catalog synchronization, status cache behavior, reservations, analytics,
  billing, and frontend screens are outside this service boundary.
- Alembic migrations are deferred; startup table creation is the accepted MVP
  development baseline for this prompt.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
