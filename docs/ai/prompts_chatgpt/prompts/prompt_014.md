# Prompt 014

Source PDF: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection.pdf`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection`

Source pages:

- Prompt: page 75
- Response: pages 75-80

Transcription note: The review request, status, and beginning of the architecture summary are visible. The collapsed implementation report is referenced by the response and remains available in the repository run report.

## Prompt

This is the output of Codex. Inspect it (via the live connector) and tell me if we are okay for phase D.

## Status
PASS_WITH_WARNINGS

## Architecture implemented
Implemented Phase C only: `scheduler-service` control plane, `scheduler-postgres`, scheduler-owned metadata

[The remaining Codex-output text is collapsed in the PDF export.]

## Response

Συμπέρασμα

Η Phase C είναι ουσιαστικά επιτυχημένη, αλλά εγώ δεν θα πήγαινα ακόμα Phase D
πριν κάνουμε ένα μικρό Phase C hardening fix.

Ο λόγος: ο scheduler/control-plane υλοποιήθηκε σωστά, αλλά από το
nginx/default.conf φαίνεται ότι τα broad gateway routes πιθανώς εκθέτουν τα
/internal/jobs/* endpoints μέσω gateway. Τα endpoints έχουν X-Scheduler-Token ,
άρα δεν είναι ανεξέλεγκτα, αλλά το design ζητούσε να μην είναι καν διαθέσιμα από το
gateway/browser path.

Άρα: Phase C PASS με ένα μικρό hardening TODO πριν Phase D.

Τι επιβεβαίωσα από το repo
Περιοχή            Κατάσταση      Evidence

Scheduler                   OK    Το run report λέει ότι προστέθηκε services/scheduler-
service                           service με FastAPI, persistence, seeded jobs, loop, internal
                                  HTTP client, operator APIs και tests.
                                          018-scheduler-control-plane-imp…

Scheduler DB                OK     docker-compose.yml έχει scheduler-postgres με δικό του

                                  volume και DB scheduler .                   docker-compose

Compose                     OK    Το gateway εξαρτάται από scheduler-service , και το
wiring                            scheduler έχει env vars, service URLs και dependencies προς
                                  target services.              docker-compose        docker-compose

Gateway route           OK για    Υπάρχει /api/scheduler/ route προς scheduler-service .
                  scheduler API           default          default

Operator                    OK    Τα scheduler APIs καλούν ensure_operator(principal) για
protection                        jobs/runs/manual run/pause/resume.                     routes        routes

Job definitions             OK    Περιλαμβάνονται catalog import, analytics consume/refresh,
                                  billing drain/outbox/invoices, reservation outbox και manual
                                  jobs.             jobs

Internal              OK εντός    Τα catalog internal endpoints απαιτούν X-Scheduler-Token και
endpoint auth           service    X-Job-Run-Id .               routes   Τα analytics internal endpoints
                                  κάνουν το ίδιο.              routes

Περιοχή              Κατάσταση       Evidence

No cross-            OK by report    Το run report δηλώνει conformance: no cross-service DB
service DB                           access, no scheduler-owned business logic, no live user
                                     actions moved to RabbitMQ.               018-scheduler-control-plane-imp…

Validation                Strong     Πέρασαν scheduler/service/frontend/shared
                                     events/PlantUML/Docker/gateway/auth/manual-run checks.
                                         018-scheduler-control-plane-imp…

GitHub issue                   OK    Phase C issue #18 είναι closed/completed.
                                         Phase C - Resolve final warning…   Phase D issue #17 μένει open.
                                         Phase D - Expand application te…

Το σημείο που θέλει διόρθωση πριν Phase D
Το Nginx έχει broad routes:

       Nginx

  location /api/catalog/ {
       proxy_pass http://catalog_service_upstream/;
  }

  location /api/analytics/ {
       proxy_pass http://analytics_service_upstream/;
  }

  location /api/billing/ {
       proxy_pass http://billing_service_upstream/;
  }

  location /api/reservations/ {
       proxy_pass http://reservation_service_upstream/;
  }

Αυτό σημαίνει ότι, χωρίς explicit deny/block, ένα URL τύπου:

  /api/catalog/internal/jobs/catalog/imports/all

μπορεί να γίνει proxy προς:

  catalog-service:/internal/jobs/catalog/imports/all

Το catalog-service όντως έχει τέτοιο internal endpoint.
                                                routes

Το ίδιο pattern υπάρχει και στο analytics service.            routes

Ναι, απαιτείται X-Scheduler-Token , αλλά το design/Prompt ζητούσε να μην εκτίθενται τα
/internal/jobs/* routes από Nginx. Το ίδιο το Phase C report λέει ότι έγινε “Nginx
internal job exposure check”, αλλά από το checked default.conf δεν βλέπω explicit
block.

                                   018-scheduler-control-plane-imp…

Άρα αυτό θέλει μικρό hardening patch.

Επίσης: πρόσθεσε το token στο local .env
Το .env.example έχει:

         env

  SCHEDULER_INTERNAL_TOKEN=change-me-scheduler-token

                                                .env

Στο δικό σου .env βάλε random value, π.χ. όχι αυτό ακριβώς:

         env

  SCHEDULER_INTERNAL_TOKEN=<long-random-local-token>

Μην το κάνεις commit.

Αν δεν το βάλεις, το Compose default είναι γνωστό placeholder. Για local demo δεν είναι
καταστροφή, αλλά αφού πλέον έχουμε real provider credentials και scheduler endpoints,
καλύτερα να το βάλεις σωστά.

Πώς συνεχίζουμε

Βήμα 1 - Μικρό Phase C hardening prompt
Δώσε αυτό στον Codex πριν Phase D:

Continue Phase C hardening only.

The Phase C scheduler/control-plane implementation passed, but before Phase D we ne

Issue:
The Nginx gateway has broad routes such as `/api/catalog/`, `/api/analytics/`, `/ap

Tasks:
1. Inspect `deploy/nginx/default.conf` and all service-owned `/internal/jobs/*` rou
2. Add explicit Nginx deny/block rules before the broad service proxy locations so
  - `/api/catalog/internal/`
  - `/api/analytics/internal/`
  - `/api/billing/internal/`
  - `/api/reservations/internal/`
3. Prefer `return 404` or `return 403`; choose one consistently and document it.
4. Do not block `/api/scheduler/*`.
5. Do not change scheduler-service internal Docker calls.
6. Do not modify `.env`.
7. Do not print secrets.
8. Add/update focused tests or smoke checks proving:
  - gateway `/api/catalog/internal/...` is blocked;
  - gateway `/api/analytics/internal/...` is blocked;
  - gateway `/api/billing/internal/...` is blocked;
  - gateway `/api/reservations/internal/...` is blocked;
  - `/api/scheduler/health` still works;
  - scheduler manual run still works through internal Docker service URLs.
9. Update:
  - `docs/ai/codex-runs/018-scheduler-control-plane-implementation.md`
  - `docs/final-verification.md`
  - `docs/submission-checklist.md`
  - `docs/ai/prompt-log.md` only if needed
10. Do not start Phase D.
11. Keep Phase C issue #18 closed unless GitHub process requires a follow-up commen

Return:
## Status
PASS / PASS_WITH_WARNINGS / FAIL

## Hardening change
What changed.

## Validation
Commands and results.

## Files changed
Exact files.

## Warnings
Only real warnings.

## Blockers

  No blockers, or exact blockers.

  ## Phase D readiness
  Whether Phase D can start.

Βήμα 2 - Μετά, ναι πάμε Phase D
Αν αυτό περάσει, τότε Phase D είναι το σωστό επόμενο βήμα. Το Phase D issue είναι ήδη
ανοιχτό και αφορά root-level/cross-app test coverage.
                                    Phase D - Expand application te…

Τελική απάντηση
Όχι ακόμα Phase D. Είμαστε πολύ κοντά, αλλά πρώτα κάνε το μικρό Nginx hardening για
να μπλοκαριστούν gateway paths προς /internal/jobs/* .

Μετά από αυτό, ναι: Phase D
