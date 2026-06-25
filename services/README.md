# Services

`services/` contains the FastAPI backend services used by the local Docker
Compose runtime.

## Inventory

| Directory | Compose service | Purpose | Database | Event role |
|---|---|---|---|---|
| `auth-service/` | `auth-service` | Users, local auth, Google OAuth, JWT/refresh tokens | `auth-postgres` | none |
| `provider-registry-service/` | `provider-registry-service` | Provider metadata and audit logs | `provider-registry-postgres` | none |
| `red-provider-service/` | `red-provider-service` | redPlug adapter, raw payloads, snapshots | `red-provider-postgres` | none |
| `green-provider-service/` | `green-provider-service` | greenPlug adapter, raw payloads, snapshots | `green-provider-postgres` | none |
| `blue-provider-service/` | `blue-provider-service` | bluePlug adapter, raw payloads, snapshots | `blue-provider-postgres` | none |
| `catalog-service/` | `catalog-service` | Catalog search, imports, point views | `catalog-postgres` | publishes catalog/usage events |
| `status-service/` | `status-service` | Status cache, live lookup, fallback logs | `status-postgres` | publishes status events |
| `reservation-service/` | `reservation-service` | Reservation creation, locks, attempts, outbox | `reservation-postgres` | outbox publishes reservation events |
| `analytics-service/` | `analytics-service` | Event ingestion, aggregates, dashboards, CSV export | `analytics-postgres` | consumes `analytics.events` |
| `billing-service/` | `billing-service` | Pricing, charges, invoices, mock payments, outbox | `billing-postgres` | consumes `billing.reservations`, outbox publishes billing events |
| `scheduler-service/` | `scheduler-service` | Job metadata, manual runs, ordered maintenance | `scheduler-postgres` | calls internal job endpoints |

## Conventions

- Services are Python FastAPI apps with `app/main.py`, `app/routes.py`,
  Pydantic schemas, and SQLAlchemy models where stateful.
- HTTP health routes are `/health`; most services also expose `/ready`.
- Public traffic goes through `nginx-gateway`; backend containers expose port
  `8000` only on the Docker network.
- Provider adapter routes use `/internal/*` and are not exposed by the gateway.
- Scheduler job routes use `/internal/jobs/*` with `X-Scheduler-Token`.
- Each stateful service owns its own database. There are no cross-service SQL
  joins or shared mutable tables.

## Gateway Prefixes

| Prefix | Service |
|---|---|
| `/api/auth/*` | `auth-service` |
| `/api/providers/*`, `/api/provider-registry/*` | `provider-registry-service` |
| `/api/catalog/*` | `catalog-service` |
| `/api/status/*` | `status-service` |
| `/api/reservations/*` | `reservation-service` |
| `/api/analytics/*` | `analytics-service` |
| `/api/billing/*` | `billing-service` |
| `/api/scheduler/*` | `scheduler-service` |

## Service READMEs

Each service directory has a README with its runtime, API surface, persistence,
messaging, dependencies, and test command:

- `auth-service/README.md`
- `provider-registry-service/README.md`
- `red-provider-service/README.md`
- `green-provider-service/README.md`
- `blue-provider-service/README.md`
- `catalog-service/README.md`
- `status-service/README.md`
- `reservation-service/README.md`
- `analytics-service/README.md`
- `billing-service/README.md`
- `scheduler-service/README.md`

## Commands

Run a service test suite through its Compose image:

```bash
docker compose run --build --rm --no-deps auth-service pytest -q
```

Validate the Compose topology without printing interpolated secrets:

```bash
docker compose config --quiet
```
