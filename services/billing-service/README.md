# billing-service

## Purpose

Owns pricing rules, billing event ingestion, charge records, invoice issuance,
invoice lines, mock payments, and billing event outbox state.

## Runtime

- Compose service: `billing-service`
- Container port: `8000`
- Database: `billing-postgres`
- Main app: `app/main.py`
- Gateway prefix: `/api/billing/*`

## Responsibilities

- Drain billing events from RabbitMQ or ingest events directly.
- Create charges for reservation success and optional point-view/failure fees.
- Issue invoices from unbilled charge records.
- Record full mock payments and prevent duplicate payments.
- Stage billing events in `billing_event_outbox`.
- Expose provider/operator billing summaries.

## API Surface

| Scope | Method/path | Purpose |
|---|---|---|
| Authenticated | `POST /events/ingest` | Direct billing event ingest |
| Operator | `POST /events/drain` | Drain billing queue |
| Operator | `POST /events/outbox/publish-pending` | Publish billing outbox |
| Internal scheduler | `POST /internal/jobs/events/drain` | Scheduled billing drain |
| Internal scheduler | `POST /internal/jobs/outbox/publish-pending` | Scheduled outbox publish |
| Internal scheduler | `POST /internal/jobs/invoices/prepare` | Prepare invoice candidates |
| Internal scheduler | `GET /internal/jobs/freshness` | Internal freshness read |
| Operator | `GET/POST/PATCH /pricing/rules...` | Manage pricing rules |
| Authenticated | `GET /pricing/effective/{provider_code}` | Effective provider pricing |
| Operator/provider admin | `GET /charges`, `GET /charges/{charge_id}` | Charge reads |
| Operator | `POST /invoices/issue` | Issue invoice |
| Operator/provider admin | `GET /invoices`, `GET /invoices/{invoice_id}` | Invoice reads |
| Operator/provider admin | `POST /invoices/{invoice_id}/pay` | Mock full payment |
| Operator/provider admin | `GET /overview`, `GET /providers/{provider_code}/overview` | Billing summaries |
| Health | `GET /health`, `GET /ready` | Service health |

## Persistence

| Table | Purpose |
|---|---|
| `pricing_rules` | Global/provider pricing rules |
| `billing_events` | Idempotent billing event records |
| `charge_records` | Charges and invoice/payment state |
| `invoices`, `invoice_lines`, `payments` | Invoice and mock payment records |
| `billing_event_outbox` | Pending/published billing events |

## Messaging

| Direction | Event/routing key/queue | Purpose |
|---|---|---|
| Consume | `billing.reservations` | `reservation.succeeded`, `reservation.failed`, `usage.point_viewed` |
| Outbox publish | `billing.charge_created` | Charge event |
| Outbox publish | `billing.invoice_issued` | Invoice-issued event |
| Outbox publish | `billing.invoice_paid` | Invoice-paid event |

## Dependencies

- Calls: RabbitMQ when draining queue or publishing outbox.
- Called by: frontend through gateway, `scheduler-service`, event flow.
- External systems: none; payments are mock records only.

## Tests

```bash
docker compose run --build --rm --no-deps billing-service pytest -q
```
