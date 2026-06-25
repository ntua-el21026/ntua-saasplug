# Codex Run 062 - Invoices and Sync Dedup Polish

## Invocation Prompt

```text
1. Consult screenshot 9 under "\\wsl.localhost\Ubuntu-24.04\home\peppasmich\screenshots".
Make provider selector disappear, as when we press issue invoice, we go to another page to select there.
So, just leave the button on the left, just above unpaid card, with the same width as the card below.

2. Them consult screenshot 10, 11 and just answer to me in the chat: what does the data freshness and Scheduler run history show? How do the bars get points and get bigger? Why do we have "Import all provider catalogs" twice with different values? Actually, we have many duplicates with different values, why?

3. Then, in screenshot 12, why do we have a different tab for the manual operations? Are they included in the Scheduled jobs table? If yes, remove the last tab... We dont want duplicates. Also, explain what each entry of "Scheduler control plane" does, in detail and simple words and why we have manual flows that are not automatic.
```

## Goal

Remove duplicated operator UI controls from invoices and sync pages, and explain scheduler/system charts and scheduler job semantics.

## Scope

- Frontend operator invoices page.
- Frontend operator sync page.
- Frontend admin-routing tests.
- AI run log updates.
- No backend, scheduler, billing, analytics, catalog, or status service behavior changes.

## Implementation Summary

- Removed the provider selector from `/operator/invoices`.
- Kept only the `Issue invoice` action on the left above the metric cards.
- Added invoice action layout so the button occupies the same grid column width as the first metric card on desktop and becomes full-width on narrow screens.
- Removed the `Manual operations` tab from `/operator/sync`.
- Kept manual execution available through each row's `Run` button in the `Scheduled jobs` table, including manual schedule-type jobs.
- Removed unused CSS selectors for the deleted manual operations card grid.
- Updated tests to verify:
  - operator invoices no longer expose a provider selector;
  - invoices list calls `/api/billing/invoices` without `providerCode`;
  - manual scheduler jobs are visible in `Scheduled jobs`;
  - the `Manual operations` tab is gone;
  - manual jobs can be launched from the table `Run` button.
- Stabilized the first lazy admin-route test with `vi.dynamicImportSettled()`.

## Files Changed

- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/062-invoices-and-sync-dedup-polish.md`

## Tests and Checks Run

```text
cd apps/frontend && npx vitest run src/test/admin-routing.test.tsx -t "renders scheduler controls for operators|renders operator invoices without a provider filter" --reporter=verbose
```

Result: passed, 2 targeted tests.

```text
cd apps/frontend && npx tsc --noEmit
```

Result: passed.

```text
cd apps/frontend && npm test -- --run src/test/admin-routing.test.tsx --reporter=verbose
```

Result: passed, 31 tests.

```text
cd apps/frontend && npm run build
```

Result: passed.

```text
git diff --check
```

Result: passed.

## Limitations

- Screenshots were inspected from `/home/peppasmich/screenshots`, but no live browser visual QA was performed after the edits.
- Existing unrelated modified files were preserved.

## SPEC Conformance

- Conforms to `docs/specs/SPECIFICATIONS.md`.
- Keeps frontend API access gateway-relative.
- Does not change scheduler job definitions, billing behavior, invoice issuance behavior, provider codes, roles, or service boundaries.
