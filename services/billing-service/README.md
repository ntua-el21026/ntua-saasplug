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

## References

- `AGENTS.md`
- `docs/specs/SPECIFICATIONS.md`
