# Prompt 013

Source PDF: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection.pdf`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection`

Source pages:

- Prompt: pages 57-58
- Response: pages 58-62

Transcription note: The user request and changed-file summary are visible. The hidden completion details can be checked in the referenced run report, but are not silently substituted here.

## Prompt

Έδωσα αυτό το prompt και αυτή ήταν η έξοδος. Δες το από το repo με το connector και πες μου πώς συνεχίζουμε.

Done. I created the Phase C scheduler/control-plane design only, with no application source changes.

Changed files:
- `docs/ai/prompts/prompt_17_scheduler_design.md`
- `docs/ai/codex-runs/017-scheduler-design.md`

[The remaining Codex-output text is collapsed in the PDF export.]

## Response

Έλεγχος του design
Το design που παρήγαγε ο Codex είναι σωστό και εφαρμόσιμο. Κρατάει τη hybrid
προσέγγιση που συμφωνήσαμε:

  central scheduler-service as control-plane
  +
  service-owned business execution

Το αρχείο δηλώνει ρητά ότι το scheduler-service δεν είναι business orchestrator, δεν
διαβάζει/γράφει βάσεις άλλων services, και εκτελεί jobs καλώντας Docker-internal HTTP
endpoints των υπεύθυνων services.
                                      017-scheduler-design

Τι επιβεβαιώνεται από το design
Θέμα                  Απόφαση                                   Αξιολόγηση

Νέα                    scheduler-service + scheduler-           Σωστό, αλλά είναι SPEC
service/container     postgres                                  amendment γιατί προστίθεται
                                                                νέο service.
                                                                     017-scheduler-design

Ρόλος scheduler       Control-plane μόνο, όχι business          Σωστό.         017-scheduler-design

                      orchestrator

Εκτέλεση jobs         Internal HTTP endpoints στα responsible   Σωστό και απλό για Docker
                      services                                  Compose.
                                                                     017-scheduler-design

Ασφάλεια internal      X-Scheduler-Token , X-Job-Run-Id ,       Σωστό.         017-scheduler-design

endpoints             redacted summaries

Θέμα                   Απόφαση                                     Αξιολόγηση

Jobs                   Catalog import, analytics drain/refresh,    Καλό αρχικό set.
                       billing drain/outbox, reservation outbox,        017-scheduler-design

                       invoice preparation

Operator UI/API         /api/scheduler/jobs , run history,         Χρήσιμο για τελική επίδειξη.
                       pause/resume, health                             017-scheduler-design

Risks                  Duplicate execution, provider rate          Καλύπτονται σωστά.
                       pressure, secret leakage, data ownership         017-scheduler-design

                       drift

Acceptance criteria    No cross-service DB writes, no RabbitMQ     Σωστά.         017-scheduler-design

                       for live actions, no secret logging

Η μόνη σημαντική απόφαση πριν implementation
Πρέπει να αποδεχτούμε επίσημα ότι το canonical service set επεκτείνεται με:

  scheduler-service
  scheduler-postgres

Το ίδιο το design το αναφέρει ως pre-implementation confirmation: να επιβεβαιωθεί ότι
αυτά γίνονται αποδεκτά ως SPEC amendment.
                                         017-scheduler-design

Εγώ θα το αποδεχόμουν. Είναι τεχνικά σωστό και πλέον justified από το Phase C
hardening scope.

Πώς συνεχίζουμε
Δεν θα έδινα ένα τεράστιο implementation prompt. Θα το σπάσουμε σε μικρά prompts.

Βήμα 0 - Checkpoint
Πριν από νέο Codex prompt:
 1. Κάνε ένα commit ή τουλάχιστον βεβαιώσου ότι το working tree είναι καθαρό/
       κατανοητό.
 2. Μην ανακατέψεις Phase A/B/C changes χωρίς checkpoint.

Προτεινόμενο commit message:

  feat(scheduler): add Phase C scheduler design documentation

ή αν κάνεις commit όλα τα Phase A/B/C docs/fixes μαζί:

  chore(project): record finalization audit and live provider verification

Βήμα 1 - SPEC amendment μόνο
Πρώτα να ενημερώσει τα docs/specs ώστε να μη φαίνεται ότι το scheduler-service
παραβιάζει το canonical service set.

Prompt για Codex

  Continue Phase C only.

  Task: record the accepted scheduler/control-plane SPEC amendment.

  Context:
  - Phase B passed with warnings and issue #16 is closed.
  - Phase C scheduler design was completed in `docs/ai/codex-runs/017-scheduler-desig
  - We accept the hybrid approach:
    - `scheduler-service` as central control-plane;
    - `scheduler-postgres` as scheduler-owned database;
    - service-owned execution through internal HTTP job endpoints;
    - no business logic inside scheduler-service;
    - no cross-service DB access;
    - no RabbitMQ for live user actions.

  Do not implement source code yet.

  Update only documentation and AI logs:
  - `docs/specs/SPECIFICATIONS.md`
  - `docs/architecture-summary.md`
  - `docs/ai/prompts/prompt_18_scheduler_spec_amendment.md`
  - `docs/ai/codex-runs/018-scheduler-spec-amendment.md`
  - `docs/ai/prompt-log.md`

  If needed, update `README.md` only to mention the accepted scheduler-service additi

  Do not modify application code.
  Do not modify Docker Compose yet.
  Do not modify frontend code.
  Do not start scheduler implementation.
  Do not touch Phase D.

  Also update Phase C issue/project status if available:
  - keep Phase C issue open/In Progress;

  - do not close it yet.

  Return:
  ## Status
  ## Spec amendment summary
  ## Files changed
  ## Warnings
  ## Blockers
  ## Next step

Βήμα 2 - Scheduler service scaffold
Μετά το spec amendment, δίνουμε μικρό implementation prompt μόνο για το skeleton.

Να δημιουργήσει:

  services/scheduler-service/
  scheduler-postgres
  docker-compose entries
  gateway route /api/scheduler/*
  health endpoint
  operator JWT protection skeleton
  scheduler DB connection
  basic tables/models
  tests for health/config/security

Όχι ακόμα πραγματικά jobs.

Βήμα 3 - Internal job endpoints
Μετά υλοποιούμε ανά service:
 1. reservation-service : outbox publish job.
 2. analytics-service : consume events + refresh aggregates.
 3. billing-service : drain events + publish outbox.
 4. catalog-service : import all/providers.

Να μη γίνουν όλα με ένα prompt αν δεν χρειάζεται.

Βήμα 4 - Scheduler executes jobs
Αφού υπάρχουν endpoints, τότε βάζουμε:
    due-job loop,

    manual run,
    run history,
    retries,
    lock handling,
    safe response summaries.

Βήμα 5 - Operator UI
Τελευταίο:
    scheduler status cards,
    job list,
    run history,
    manual run buttons,
    pause/resume.

Προτεινόμενη σειρά Phase C
                Step   Prompt                         Περιεχόμενο

                 18    SPEC amendment                 Αναγνώριση scheduler-service ως
                                                      accepted architecture extension

                 19    Scheduler scaffold             Service, DB, Docker, gateway, health,
                                                      models

                 20    Internal job endpoints         Service-owned endpoints στα
                                                      catalog/analytics/billing/reservation

                 21    Scheduler execution            Job loop, manual runs, retries, run history

                 22    Operator UI                    Scheduler dashboard/controls

                 23    Verification                   Full Phase C validation και close issue

Αυτή είναι η πιο ασφαλής πορεία.
