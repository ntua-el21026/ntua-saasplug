# Prompt 19 - Phase D Test Expansion

## Invocation

Continue with Phase D only.

## Goal

Expand application test coverage for saasPlug without changing architecture or
adding new features.

## Context

- Phase A, Phase B, and Phase C are complete.
- Phase C added `scheduler-service`, `scheduler-postgres`, internal job
  endpoints, operator scheduler UI/API, and Nginx hardening.
- Phase D issue #17 is open/Todo.
- Do not touch `.env`.
- Do not print secrets.
- Do not deploy.
- Do not use Vercel.
- Do not change architecture.

## Tasks

1. Inspect current tests across:
   - `apps/frontend/src/test/`
   - `services/*/tests/`
   - `packages/events/tests/`
2. Create a concise test gap analysis.
3. Add a root-level `tests/` directory only if it is useful for cross-service,
   Docker, or integration tests.
4. Add focused tests for:
   - auth login and role access;
   - provider normalization and Bearer auth behavior;
   - catalog bounds/search/import behavior;
   - status cache and fallback behavior;
   - reservation success/failure/unknown normalization;
   - analytics ingestion/idempotency/aggregate refresh;
   - billing event drain/idempotency/invoice/payment behavior;
   - scheduler operator authorization, manual runs, internal route blocking,
     and run history;
   - gateway smoke paths;
   - frontend role routing and scheduler UI access.
5. Keep service-local tests where they fit best; use root-level tests only for
   integration/cross-service/gateway behavior.
6. Update documentation for how to run tests.
7. Update AI logs:
   - create `docs/ai/prompts/prompt_19_phase_d_test_expansion.md`;
   - create `docs/ai/codex-runs/019-phase-d-test-expansion.md`;
   - update `docs/ai/prompt-log.md`.
8. Update `docs/final-verification.md` and `docs/submission-checklist.md` only
   if verification status changes.
9. If all Phase D checks pass or pass with accepted warnings, close Phase D
   issue #17 and move it to Done in Project #2 if possible.

## Validation

- Run frontend tests/build.
- Run all touched service tests.
- Run scheduler tests.
- Run shared event tests.
- Run Docker Compose config/startup/health.
- Run gateway smoke checks.
- Run authenticated EV/provider/operator smoke checks.
- Verify internal job gateway routes still return 404.
- Run `git diff --check`.
- Verify `.env` is not tracked.

## Final Response

Return:

```text
## Status
PASS / PASS_WITH_WARNINGS / FAIL

## Test expansion summary
What tests were added and why.

## Validation
Commands and results.

## Files changed
Exact list.

## Warnings
Only real warnings.

## Blockers
No blockers, or exact blockers.

## GitHub issue/project status
Whether Phase D issue #17 was closed/moved to Done.

## Final readiness
Whether the repository is ready for final course submission.
```
