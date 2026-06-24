# Run 052 - Frontend Reservation Retry Idempotency

## Invocation Prompt

Update `apps/frontend/src/features/catalog/PointDetailPage.tsx` so an explicit
retry after a completed failed reservation request uses a fresh
`Idempotency-Key`. Keep one key only for duplicate prevention while the original
submission remains in flight. Do not change backend idempotency semantics. Add
frontend coverage for duplicate in-flight submission and retry-after-failure,
then run frontend tests and build only.

## Goal

Correct frontend idempotency-key lifecycle without changing the reservation API
or backend behavior.

## Scope

- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- Focused frontend route tests
- Frontend README reservation behavior note

## Implementation Summary

- Replaced the persistent dialog-level key state with an in-flight-only request
  reference.
- Blocked a second form submission while the original reservation request is
  outstanding.
- Generated a new key for each completed explicit retry.

## Files Changed

- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/052-frontend-reservation-retry-idempotency.md`

## Validation

- `npm test -- src/test/admin-routing.test.tsx` completed for the focused route
  suite.
- `npm test`: passed, 4 test files and 41 tests.
- `npm run build`: passed (`tsc --noEmit && vite build`).
- Build output was created in ignored `apps/frontend/dist/`.

## Limitations

- Backend idempotency semantics were not changed.
- No live provider requests or Docker runtime checks are in scope for this run.
