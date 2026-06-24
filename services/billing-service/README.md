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

Operators can create active global or provider-specific override rules. Only
one global rule can be active at a time, and only one rule per provider can be
active at a time. Provider-specific active rules override the global fallback.
When all three providers have active provider-specific rules, global rules are
deactivated. Activating a global rule deactivates provider-specific rules.

Provider admins can read only their own effective provider pricing.

## Event ingestion and charges

Billing consumes canonical `packages/events` envelopes for:

- `reservation.succeeded`
- `reservation.failed`
- `usage.point_viewed`

`reservation.succeeded` creates one unbilled `reservation_success` charge.
`usage.point_viewed` creates one unbilled `point_view` charge only when the
effective pricing rule enables the point-view fee. These events include both
map/list quick views and full point-detail views. `reservation.failed` is
recorded and skipped by default because the seeded failure fee is `0.00`.

Charge idempotency is enforced by `charge_records.source_event_id`, which is the
source envelope `event_id`. Ingested events are recorded in `billing_events`
with `charged`, `skipped`, `duplicate`, `unsupported`, or `failed` results.

## Invoices and mock payment

Only operators can issue invoices. Invoice issuance selects unbilled charges for
one provider and billing period, creates invoice lines, marks charges
`invoiced`, and stages a `billing.invoice_issued` outbox event.
Candidate charges are selected with row locking where supported and filtered by
`invoice_id IS NULL`. A fresh-database uniqueness constraint on
`invoice_lines.charge_id` ensures a charge can appear in at most one invoice;
overlapping issuance either finds no eligible charges or fails cleanly with a
conflict.

Provider admins can view and pay issued invoices only for their own provider.
The payment flow is mock and full-invoice only: it creates one payment record,
marks the invoice `paid`, marks invoice charges `paid`, and stages a
`billing.invoice_paid` outbox event.

Invoice payment is guarded so an invoice can have only one successful payment.
The payment path reloads the invoice under a database row lock, checks for an
existing succeeded payment, and relies on a fresh-database unique constraint on
`payments.invoice_id` to reject duplicate concurrent submissions.

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

Provider-admin `/charges` responses are scoped to the provider in the JWT and
omit direct EV user IDs, reservation IDs, and raw event payloads. Operators
retain the richer internal charge shape.

## RabbitMQ

The service uses the shared `packages/events` topology. The
`billing.reservations` queue receives reservation events and
`usage.point_viewed` so the billing service can consume point-view events
without a new runtime queue or container.

`POST /events/drain` is an operator-only global bounded manual queue drain for
local demo and testing. Provider admins cannot trigger it. There is no
provider-scoped refresh route because the queue drain processes the shared
billing queue, not a provider-filtered queue. There is no separate worker
container, orchestrator, or distributed transaction mechanism.

`POST /events/outbox/publish-pending` publishes pending billing outbox rows to
the configured `saasplug.events` exchange and preserves failed rows as pending
with attempt/error metadata.

Draining billing events and publishing the billing outbox are intentionally
separate. The drain step consumes `reservation.succeeded`,
`reservation.failed`, and `usage.point_viewed` to create billing-owned records.
The outbox publish step propagates billing-created charge, invoice, and payment
events after billing has already committed its own state.

Internal scheduler endpoints:

```text
POST /internal/jobs/events/drain
POST /internal/jobs/outbox/publish-pending
POST /internal/jobs/invoices/prepare
GET  /internal/jobs/freshness
```

`scheduler-service` calls these endpoints over Docker-internal URLs with
`X-Scheduler-Token` and `X-Job-Run-Id`. The Nginx gateway returns HTTP 404 for
`/api/billing/internal/...`.

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
SCHEDULER_INTERNAL_TOKEN
SAASPLUG_STRICT_SECRETS
APP_ENV
```

When `SAASPLUG_STRICT_SECRETS=true` or `APP_ENV` is production-like, unsafe
placeholder JWT, scheduler-token, and RabbitMQ credential values are rejected
at startup.

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

Existing local Docker volumes created before the `payments.invoice_id` or
`invoice_lines.charge_id` unique constraints will not be altered by SQLAlchemy
`create_all`; recreate development volumes or add a service-local migration
before relying on those database-level constraints in an older local database.

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
