# Prompt 015

Source PDF: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection.pdf`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection`

Source pages:

- Prompt: page 80
- Response: pages 80-84

Transcription note: Both questions and the hardening status are visible. The pasted hardening details are collapsed; the response independently verifies and explains them.

## Prompt

1. Τι value να βάλω εδώ;

`SCHEDULER_INTERNAL_TOKEN=<long-random-local-token>`

2. Δες το repo μετά την απάντηση του Codex και εάν είμαστε καλά πάμε στη φάση D.

## Status
PASS

## Hardening change

[The remaining Codex-output text is collapsed in the PDF export.]

## Response

1. Τι value να βάλεις στο SCHEDULER_INTERNAL_TOKEN
Βάλε τυχαίο μεγάλο token, όχι το default:

      env

  SCHEDULER_INTERNAL_TOKEN=change-me-scheduler-token

Καλύτερη μορφή: hex string 64-96 χαρακτήρων, χωρίς κενά, χωρίς quotes.

Στο WSL τρέξε:

      Bash

  openssl rand -hex 48

Θα σου δώσει κάτι σαν:

  9f0e2c5a7b...<96 hex chars total>

Στο .env βάλε:

      env

  SCHEDULER_INTERNAL_TOKEN=<το output του openssl rand -hex 48>

Μην το βάλεις στο .env.example , μην το κάνεις commit, μην το γράψεις σε docs/logs.

2. Έλεγχος repo μετά το hardening
Ναι, τώρα είμαστε καλά για Phase D.

Το hardening εφαρμόστηκε σωστά: το Nginx πλέον μπλοκάρει ρητά τα internal job gateway
paths με 404 πριν από τα broad proxy routes:

      Nginx

  location ^~ /api/catalog/internal/ {
      return 404;
  }

  location ^~ /api/reservations/internal/ {
      return 404;
  }

  location ^~ /api/analytics/internal/ {
      return 404;
  }

  location ^~ /api/billing/internal/ {
      return 404;
  }

Ταυτόχρονα, το /api/scheduler/ παραμένει διαθέσιμο μέσω gateway προς scheduler-
service .

                                              default

Το updated Phase C run report επίσης καταγράφει ότι πέρασαν:

    gateway block smoke για catalog/analytics/billing/reservations internal routes με 404 ,
     /api/scheduler/health με 200 ,
    scheduler manual run smoke για billing.prepare-invoices ,
     nginx -t ,
    Docker cleanup,
     git diff --check .
                                        018-scheduler-control-plane-imp…

Η Phase C παραμένει conformant: no cross-service DB access, no scheduler-owned
business logic, no live user actions moved to RabbitMQ, service-owned execution,
frontend only gateway /api/... .
                                     018-scheduler-control-plane-imp…

Verdict
Phase C is complete. We can start Phase D.

Υπάρχουν μόνο προηγούμενες non-blocking limitations: δεν έγινε automatic shortened-
interval scheduler-loop smoke και δεν έγινε browser visual QA. Αυτά είναι λογικό να
καλυφθούν/ενισχυθούν στη Phase D test expansion.

                                     018-scheduler-control-plane-imp…

Short Phase D prompt

  Continue with Phase D only.

  Goal:
  Expand application test coverage for saasPlug without changing architecture or addi

  Context:
  - Phase A, B, and C are complete.
  - Phase C added scheduler-service, scheduler-postgres, internal job endpoints, oper
  - Phase D issue #17 is open/Todo.
  - Do not touch `.env`.
  - Do not print secrets.
  - Do not deploy.
  - Do not use Vercel.
  - Do not change architecture.

  Tasks:
  1. Inspect current tests across:

  - apps/frontend/src/test/
  - services/*/tests/
  - packages/events/tests/
2. Create a concise test gap analysis.
3. Add a root-level `tests/` directory only if it is useful for cross-service / Doc
4. Add focused tests for:
  - auth login and role access;
  - provider normalization and Bearer auth behavior;
  - catalog bounds/search/import behavior;
  - status cache and fallback behavior;
  - reservation success/failure/unknown normalization;
  - analytics ingestion/idempotency/aggregate refresh;
  - billing event drain/idempotency/invoice/payment behavior;
  - scheduler operator authorization, manual runs, internal route blocking, and ru
  - gateway smoke paths;
  - frontend role routing and scheduler UI access.
5. Keep service-local tests where they fit best; use root-level tests only for inte
6. Update documentation for how to run tests.
7. Update AI logs:
  - create `docs/ai/prompts/prompt_19_phase_d_test_expansion.md`
  - create `docs/ai/codex-runs/019-phase-d-test-expansion.md`
  - update `docs/ai/prompt-log.md`
8. Update `docs/final-verification.md` and `docs/submission-checklist.md` only if v
9. If all Phase D checks pass or pass with accepted warnings, close Phase D issue #

Validation:
- run frontend tests/build;
- run all touched service tests;
- run scheduler tests;
- run shared event tests;
- run Docker Compose config/startup/health;
- run gateway smoke checks;
- run authenticated EV/provider/operator smoke checks;
- verify internal job gateway routes still return 404;
- run `git diff --check`;
- verify `.env` is not tracked.

Return:
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
