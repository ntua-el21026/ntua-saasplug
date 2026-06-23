# Codex Run 047 - UI Final Polish Pass 4

## Invocation Prompt

Direct user prompt:

```text
Make metric card header and value font size the same as the cards (Invoices in the example). Apply it everywhere.
Codex could not read the local image at `C:\Users\peppa\AppData\Local\Temp\codex-clipboard-b694b57c-a22b-4e8d-be36-e56576d995e2.png`: No such file or directory (os error 2)
```

## Canonical Task Prompt

None. This was a direct invocation prompt.

## Goal

Make metric-card labels and values match the standard card-title typography across the frontend.

## Implementation Summary

- Updated the shared metric-card CSS so both the metric label and metric value use `18px` font size and `26px` line height.
- Kept the metric label in the shared title accent color and the value in the primary text color.
- Applied the change through the shared `.ui-metric-card` and `.admin-metric-card` selectors, covering EV, provider, and operator metric cards.
- Closed GitHub issue `#24` and verified the Project v2 item is `Done`.

## Files Changed

- `apps/frontend/src/styles/app.css`

## Tests Run

```bash
npm run build
```

Result: passed. Vite emitted the existing chunk-size warning for the MapLibre bundle.

```bash
git diff --check
```

Result: passed.

## Limitations and Notes

- The supplied screenshot was unavailable in the local filesystem, so the change was implemented from the written requirement and existing card title styles.
- Browser-level visual inspection was not run in this pass.
- The full worktree still includes earlier uncommitted changes from previous polish passes; this run intentionally touched only the files listed above.

## Manual Review Notes

- This is a frontend-only typography change and does not alter API calls, routing, role behavior, or service boundaries.
