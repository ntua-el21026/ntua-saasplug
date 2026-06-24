# Run 055 - Status Cache Consistency and Profile Polish

## Invocation Prompt

Direct user requests:

> Resolve a conflict: when I reserve a charger it appears reserved in the map
> and the list but when I open the point it appears available. The reservation
> is blocked though, which is good. As a result, the status mix is also wrong.
> Fix this issue. Update the password change field to be able to see and hide
> the password (like in login). Add euro sign in the diagram of revenue.

> Be careful in the caching, I chose 30s and it did not work in the status as
> it should. It must derive the values from the operator. Make sure we fix and
> resolve this everywhere.

## Goal

Keep reservation and status presentation consistent, make the operator Sync
control plane govern the active status-cache TTL, correct the analytics status
distribution semantics, and complete the requested frontend polish.

## Implementation Summary

- Added an operator-only persisted `status_cache_policy` with a default TTL
  derived from `STATUS_CACHE_TTL_SECONDS` and a 30-second minimum.
- Made status cache policy updates recalculate expiry on existing cache rows so
  the operator-selected TTL takes effect immediately.
- Connected Sync-page `Apply minimum` and `Reset defaults` controls to both
  scheduler interval presets and the status-cache policy.
- Kept catalog `reserved` visible when a non-live cached status says
  `available`, then performed one forced backend status reconciliation.
- Made status-distribution aggregation count the latest point observation per
  provider/day and allow a later successful reservation to supersede an older
  availability observation.
- Added profile password visibility toggles and EUR formatting to provider and
  operator revenue charts.

## Files Changed

- `apps/frontend/src/features/catalog/PointDetailPage.tsx`
- `apps/frontend/src/features/auth/ProfilePage.tsx`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/admin/AdminUi.tsx`
- `apps/frontend/src/lib/types.ts`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/app-smoke.test.tsx`
- `services/status-service/app/{config,main,models,routes,schemas,security,status_logic}.py`
- `services/status-service/tests/test_status_service_api.py`
- `services/analytics-service/app/aggregates.py`
- `services/analytics-service/tests/test_analytics_service_api.py`
- `apps/frontend/README.md`
- `services/status-service/README.md`
- `services/analytics-service/README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`

## Validation

- `PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_status_service_api.py` in `services/status-service`
- `PYTHONPATH=.:../../packages/events PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest -s tests/test_analytics_service_api.py` in `services/analytics-service`
- `npm test -- --run` in `apps/frontend`
- `npm run build` in `apps/frontend`
- `git diff --check`

All commands completed successfully after correcting test selectors affected by
the new accessible password controls and supplying the existing shared-event
package path to the status-service test command.

## Limitations and Manual Review

- No provider mutation was made during this run.
- A local Vite server was started for the updated UI; no live operator
  cache-policy update was sent to a shared runtime.
- The status-distribution correction becomes visible after the normal
  reservation outbox, analytics event drain, and aggregate refresh sequence.

## SPEC Conformance

The change preserves synchronous reservation execution, gateway-only browser
calls, status-service cache ownership, operator-only control-plane access, and
event-driven analytics projections. It does not introduce cross-service SQL or
direct browser-provider calls.
