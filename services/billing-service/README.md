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

## Future implementation notes

Only operators issue invoices. Provider admins may view and pay issued invoices
through the mock full-payment flow.

Application logic is not implemented in this scaffold.

## Runtime baseline

Prompt 02 adds a minimal FastAPI container scaffold with:

```text
GET /
GET /health
GET /ready
```

These endpoints return static infrastructure metadata only. They do not query
`billing-postgres`, create charges, issue invoices, or process mock payments.

Gateway health smoke test:

```bash
curl http://localhost:8080/api/billing/health
```

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
