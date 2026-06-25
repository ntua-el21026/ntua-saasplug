# Codex Run 061 - Provider Points Filters

## Invocation Prompt

Direct user request:

```text
1. Expand the functionality of the charging points page of the provider profile, so that we can include there filters as well: the same filters an ev user has on map, all the eligible ones (for example no provider selector, as we already are a specific provider, but status, charger type, etc.) Include it in a collapsable card (like the users) under the search bar. Consult the screenshot under "\\wsl.localhost\Ubuntu-24.04\home\peppasmich\screenshots" for reference
2. Then answer: what are catalog searches? How does an event of this type happen? What are status checks?
Consult the second screenshot for the relevant metric cards and tell me how these events happen and what I see there.
```

## Goal

Add provider-scoped eligible filters to the provider charging-points page while preserving the provider isolation model, then explain the catalog search and status-check analytics metrics.

## Scope

- Reused the existing EV map `MapFilterPanel` with optional search/provider/result-limit sections.
- Added provider charging-point filters for availability/status, charger type, and stale-point inclusion under the existing search toolbar.
- Kept provider selection unavailable on the provider page because the authenticated provider admin is already scoped to one provider.

## Files Changed

- `apps/frontend/src/components/domain/ev/index.tsx`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/README.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/061-provider-points-filters.md`

## Tests and Checks Run

- `npm test -- src/test/admin-routing.test.tsx`
- `npm test -- src/test/admin-routing.test.tsx -t "scopes provider point inventory"`
- `npm test -- src/test/admin-routing.test.tsx -t "lets operators update an interval job schedule"`
- `npm run build`
- `git diff --check`

## Results

- `npm run build` passed.
- `git diff --check` passed.
- In the full `admin-routing.test.tsx` run, the updated provider point inventory test passed.
- The full `admin-routing.test.tsx` run failed in the unrelated scheduler test `lets operators update an interval job schedule`; the observed payload remained `{ "interval_seconds": 86400 }` while the test expected `{ "interval_seconds": 172800 }`.
- Focused `-t` route runs remained stuck on the lazy route loading state and did not provide a reliable isolated signal for these route-level tests.

## Limitations

- Browser visual verification was not performed before this log was created.
- The explanation of analytics metrics is provided in the chat response, not as a user-facing UI change.
- The unrelated scheduler route-test failure was not fixed in this run to avoid widening the provider-points filter scope.

## SPEC Conformance

The change preserves gateway-only frontend calls, provider-admin scoping, and the local catalog strategy. It does not add services, provider calls, migrations, or architecture changes.
