# Services

This folder contains the Python FastAPI microservices for saasPlug.

## Purpose

Each service owns a bounded responsibility and, when stateful, exactly one
PostgreSQL container. Services communicate through REST/JSON internal APIs for
live flows and RabbitMQ events for asynchronous propagation.

## Canonical Services

```text
auth-service
provider-registry-service
red-provider-service
green-provider-service
blue-provider-service
catalog-service
status-service
reservation-service
analytics-service
billing-service
```

## Responsibilities

| Service | Responsibility | Owned database |
|---|---|---|
| `auth-service` | Users, password login, JWT access tokens, refresh tokens, role/provider claims | `auth-postgres` |
| `provider-registry-service` | Provider metadata, integration config metadata, provider config audit logs | `provider-registry-postgres` |
| `red-provider-service` | `redPlug` API mapping, normalized snapshots, raw payloads, sync runs, provider-local reservations/status | `red-provider-postgres` |
| `green-provider-service` | `greenPlug` API mapping, normalized snapshots, raw payloads, sync runs, provider-local reservations/status | `green-provider-postgres` |
| `blue-provider-service` | `bluePlug` API mapping, normalized snapshots, raw payloads, sync runs, provider-local reservations/status | `blue-provider-postgres` |
| `catalog-service` | Aggregated normalized catalog, point imports, bounds queries, cached point details | `catalog-postgres` |
| `status-service` | 5-minute status cache, status lookup logs, fallback to last known cached status | `status-postgres` |
| `reservation-service` | Reservation truth, reservation attempts, reservation event outbox | `reservation-postgres` |
| `analytics-service` | Raw usage events, aggregate/cache tables, provider/operator analytics, CSV exports | `analytics-postgres` |
| `billing-service` | Pricing, charges, invoices, invoice lines, mock payments, billing outbox | `billing-postgres` |

## Gateway Exposure

Backend services are not exposed directly to the host. Public access goes
through `nginx-gateway`:

```text
/api/auth/...         -> auth-service
/api/providers/...    -> provider-registry-service
/api/catalog/...      -> catalog-service
/api/status/...       -> status-service
/api/reservations/... -> reservation-service
/api/analytics/...    -> analytics-service
/api/billing/...      -> billing-service
```

Provider services remain internal and are used by catalog, status, and
reservation flows through Docker-internal URLs only.

## Shared Rules

- No service writes to another service's database.
- No cross-service SQL joins.
- No shared mutable database tables.
- Use logical IDs and event/projection data where duplication is needed.
- Use canonical roles: `EV_USER`, `PROVIDER_ADMIN`, `OPERATOR`.
- Use canonical provider codes: `redPlug`, `greenPlug`, `bluePlug`.
- Do not commit real secrets or `.env`.

## Commands

Run the full stack from the repository root:

```bash
docker compose up -d --build
docker compose ps
```

Service tests are service-local. Examples:

```bash
docker compose run --build --rm --no-deps auth-service pytest -q
docker compose run --build --rm --no-deps catalog-service pytest -q
docker compose run --build --rm --no-deps billing-service pytest -q
```

Stop and remove local volumes:

```bash
docker compose down -v
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/architecture-summary.md`
- `docs/diagrams/final/component.puml`
- `docs/diagrams/final/data-model.puml`
