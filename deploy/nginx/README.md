# nginx-gateway

This folder is reserved for the Nginx API gateway/reverse proxy configuration.

## Purpose

`nginx-gateway` exposes the single local entrypoint and routes `/api/...`
requests to responsible backend service containers.

## Belongs here

- Nginx configuration files.
- Gateway route documentation.
- Gateway-specific validation notes.

## Must not be placed here

- Backend service business logic.
- Provider API adapters.
- Docker Compose service definitions outside the accepted deployment layout.
- Real secrets.

## Baseline configuration

Prompt 02 adds:

```text
deploy/nginx/default.conf
```

The gateway listens on container port `80` and is exposed by Compose on host
port `8080`.

Baseline routes:

| Gateway path | Upstream |
|---|---|
| `/` | `frontend:5173` |
| `/health` | gateway static health response |
| `/api/auth/` | `auth-service:8000` |
| `/api/provider-registry/` | `provider-registry-service:8000` |
| `/api/providers/` | `provider-registry-service:8000` |
| `/api/catalog/` | `catalog-service:8000` |
| `/api/status/` | `status-service:8000` |
| `/api/reservations/` | `reservation-service:8000` |
| `/api/analytics/` | `analytics-service:8000` |
| `/api/billing/` | `billing-service:8000` |
| `/api/scheduler/` | `scheduler-service:8000` |

Provider adapter services remain internal and are not exposed as browser-facing
business APIs.
Service-owned `/internal/jobs/...` routes remain internal and are not routed
through the gateway.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
