# billing-service

## Responsibility

`billing-service` owns pricing rules, charges, invoices, invoice lines, and
mock payments.

## Owned database

`billing-postgres`

## Exposure

Public through `nginx-gateway` under `/api/billing/...` for authorized
provider-admin and operator billing routes.

## Belongs here

- Pricing, charge, invoice, and mock-payment implementation.
- Billing event consumption and idempotency tests.
- Billing migrations and service-local docs.

## Must not be placed here

- Real payment gateway integration.
- Tax/accounting compliance beyond simple display fields.
- Analytics aggregate ownership.
- Provider API adapters.

## Runtime baseline

The service keeps the standard runtime endpoints:

```text
GET /
GET /health
GET /ready
```

Startup initializes billing-owned SQLAlchemy tables and idempotently seeds the
active global default pricing rule.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/billing/health
```

## Owned tables

`billing-service` owns:

- `pricing_rules`
- `billing_events`
- `charge_records`
- `invoices`
- `invoice_lines`
- `payments`
- `billing_event_outbox`

No other service writes to these tables.

## Pricing

The startup seed creates one active global default rule:

```text
reservation_success_fee = 0.50 EUR
point_view_fee = 0.01 EUR
point_view_fee_enabled = true
reservation_failure_fee = 0.00 EUR
```

Operators can create active global or provider-specific override rules. When a
new active rule is created for a scope, older active rules for the same scope
are deactivated.

Provider admins can read only their own effective provider pricing.

## Event ingestion and charges

Billing consumes canonical `packages/events` envelopes for:

- `reservation.succeeded`
- `reservation.failed`
- `usage.point_viewed`

`reservation.succeeded` creates one unbilled `reservation_success` charge.
`usage.point_viewed` creates one unbilled `point_view` charge only when the
effective pricing rule enables the point-view fee. `reservation.failed` is
recorded and skipped by default because the seeded failure fee is `0.00`.

Charge idempotency is enforced by `charge_records.source_event_id`, which is the
source envelope `event_id`. Ingested events are recorded in `billing_events`
with `charged`, `skipped`, `duplicate`, `unsupported`, or `failed` results.

## Invoices and mock payment

Only operators can issue invoices. Invoice issuance selects unbilled charges for
one provider and billing period, creates invoice lines, marks charges
`invoiced`, and stages a `billing.invoice_issued` outbox event.

Provider admins can view and pay issued invoices only for their own provider.
The payment flow is mock and full-invoice only: it creates one payment record,
marks the invoice `paid`, marks invoice charges `paid`, and stages a
`billing.invoice_paid` outbox event.

## API summary

Gateway prefix: `/api/billing/`.

Important service routes:

```text
GET  /pricing/rules
POST /pricing/rules
PATCH /pricing/rules/{rule_id}
GET  /pricing/effective/{provider_code}
GET  /charges
GET  /charges/{charge_id}
POST /invoices/issue
GET  /invoices
GET  /invoices/{invoice_id}
POST /invoices/{invoice_id}/pay
GET  /overview
GET  /providers/{provider_code}/overview
POST /events/ingest
POST /events/drain
POST /events/outbox/publish-pending
```

## RabbitMQ

The service uses the shared `packages/events` topology. Prompt 11 adds
`usage.point_viewed` to the existing `billing.reservations` queue binding so
the billing service can consume point-view events without a new runtime queue or
container.

`POST /events/drain` is an operator-only bounded manual queue drain for local
demo and testing. There is no worker, scheduler, orchestrator, or distributed
transaction mechanism.

`POST /events/outbox/publish-pending` publishes pending billing outbox rows to
the configured `saasplug.events` exchange and preserves failed rows as pending
with attempt/error metadata.

## Configuration

```text
DATABASE_URL
JWT_SECRET
RABBITMQ_URL
RABBITMQ_EVENT_EXCHANGE
RABBITMQ_PUBLISH_TIMEOUT_SECONDS
BILLING_RABBITMQ_CONSUME_BATCH_SIZE
BILLING_RABBITMQ_CONSUME_TIMEOUT_SECONDS
BILLING_RABBITMQ_TOPOLOGY_DECLARE_ON_STARTUP
BILLING_DEFAULT_CURRENCY
BILLING_DEFAULT_RESERVATION_SUCCESS_FEE
BILLING_DEFAULT_POINT_VIEW_FEE
BILLING_DEFAULT_POINT_VIEW_FEE_ENABLED
BILLING_DEFAULT_RESERVATION_FAILURE_FEE
```

## Tests

```bash
docker compose run --build --rm --no-deps billing-service pytest -q
docker compose run --rm --no-deps billing-service python -m pytest /tmp/packages/events/tests -q
```

The service tests use SQLite, fake publishers, and fake RabbitMQ delivery
objects. They do not require a live RabbitMQ broker or external provider APIs.

## Limitations

Out of scope:

- real payment gateway integration,
- refunds,
- partial payments,
- subscriptions,
- complex pricing tiers,
- tax/accounting compliance beyond simple display fields,
- analytics aggregate ownership,
- frontend screens.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
