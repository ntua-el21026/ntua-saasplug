# provider-registry-service

## Purpose

Owns provider metadata, integration configuration metadata, active/inactive
state, and provider configuration audit logs.

## Runtime

- Compose service: `provider-registry-service`
- Container port: `8000`
- Database: `provider-registry-postgres`
- Main app: `app/main.py`
- Gateway prefixes: `/api/providers/*`, `/api/provider-registry/*`

## Responsibilities

- List providers visible to the current principal.
- Let operators create, update, and activate/deactivate providers.
- Let provider admins update limited metadata for their own provider.
- Expose integration metadata without returning provider API secrets.
- Store provider configuration audit rows.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Authenticated | `GET /providers` | List providers by role/scope |
| Authenticated | `GET /providers/{provider_code}` | Read provider details |
| Operator | `POST /providers` | Create provider |
| Operator/provider admin | `PATCH /providers/{provider_code}` | Patch provider metadata |
| Operator | `PATCH /providers/{provider_code}/status` | Activate/deactivate provider |
| Authenticated | `GET /providers/{provider_code}/integration-config` | Read non-secret integration config |
| Authenticated | `GET /providers/{provider_code}/audit-logs` | Read provider config audit logs |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `providers` | Provider code, display/legal/contact data, base URL metadata, active state |
| `provider_config_audit_logs` | Actor, action, and changed-field audit records |

## Messaging

This service does not publish or consume RabbitMQ events in the current
implementation.

## Dependencies

- Calls: none for normal API operations.
- Called by: frontend through `nginx-gateway`; services use provider codes and
  config supplied through environment variables.
- External systems: none.

## Tests

```bash
docker compose run --build --rm --no-deps provider-registry-service pytest -q
```
