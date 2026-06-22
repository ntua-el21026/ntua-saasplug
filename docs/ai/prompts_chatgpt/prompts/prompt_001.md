# Prompt 001

Source PDF: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit and Env Connection.pdf`

Source pages:

- Prompt: page 45
- Response: pages 48-57

## Prompt

Το έτρεξα για όλους.

## Response

### Προτεινόμενη προσέγγιση

Θα ακολουθούσα αυτήν:

```text
Lightweight scheduler-service as central control-plane
+
service-owned internal job endpoints
+
optional service-owned workers only where needed later
```

Δηλαδή, για το Phase C, **όχι pure per-service loops** και **όχι full business orchestrator**.

Η πρώτη υλοποίηση να είναι:

```text
scheduler-service
    -> calls internal job endpoints on responsible services
    -> records job schedules, runs, status, errors
    -> exposes operator-visible scheduler status
```

Τα services παραμένουν ιδιοκτήτες της δουλειάς:

```text
catalog-service performs catalog import
reservation-service publishes reservation outbox
analytics-service drains events and refreshes aggregates
billing-service drains billing events and creates charges
provider services perform provider-local sync if needed
```

### Γιατί αυτή είναι η καλύτερη προσέγγιση εδώ

#### 1. Είναι πιο καθαρό για demo/εξέταση

Ο καθηγητής θα δει ένα σαφές concept:

```text
There is a scheduler/control-plane for background jobs.
```

Αυτό εξηγείται εύκολα. Έχεις ένα σημείο για:

- job definitions,
- run history,
- failures,
- retries,
- operator visibility.

Με pure per-service loops, η λογική είναι πιο "κρυμμένη" σε πολλά containers.

#### 2. Δεν γίνεται god orchestrator

Ο scheduler δεν θα κάνει business logic.

Δεν θα:

- κάνει provider normalization,
- γράφει catalog rows,
- δημιουργεί charges,
- υπολογίζει analytics,
- γράφει σε βάσεις άλλων services,
- αποφασίζει business rules.

Θα κάνει μόνο:

```text
trigger job
record status
retry if configured
show run history
```

Άρα δεν καταστρέφει microservice ownership.

#### 3. Είναι πιο ασφαλές implementation-wise

Το repo ήδη έχει service endpoints και Docker Compose. Το πιο απλό incremental βήμα είναι να προσθέσουμε:

```text
scheduler-service
scheduler-postgres
internal job endpoints
operator scheduler view/API
```

χωρίς να ξανασχεδιάσουμε όλο το event system.

### Συγκεκριμένη αρχιτεκτονική

#### Νέα service/container layer

Προσθέτουμε:

```text
scheduler-service
scheduler-postgres
```

Το scheduler-service έχει δική του βάση για:

```text
scheduled_jobs
job_runs
job_attempts / errors
```

Δεν χρησιμοποιεί τις βάσεις άλλων services.

#### Internal job endpoints

Κάθε υπεύθυνο service αποκτά internal endpoint, π.χ.:

```text
POST /internal/jobs/run
```

ή πιο συγκεκριμένα:

```text
POST /internal/jobs/sync
POST /internal/jobs/import
POST /internal/jobs/drain-events
POST /internal/jobs/refresh-aggregates
POST /internal/jobs/publish-outbox
```

Αυτά δεν πρέπει να εκτίθενται στο browser. Είναι Docker-network internal ή protected operator/internal routes.

### Ποια jobs να υλοποιηθούν πρώτα

#### 1. Provider sync / catalog import

Καλύτερη ροή:

```text
scheduler-service
  -> catalog-service internal job: import all providers
      -> catalog-service calls red/green/blue provider services
           -> provider services call live provider APIs
      -> catalog-service updates aggregated catalog
```

Αυτό είναι καλύτερο από το να καλεί ο scheduler απευθείας red/green/blue APIs.

Ο scheduler απλώς λέει:

```text
Run catalog import now.
```

Το catalog-service ξέρει πώς γίνεται.

Suggested interval:

```text
every 5 minutes
```

Env:

```env
SCHEDULER_CATALOG_IMPORT_INTERVAL_SECONDS=300
```

#### 2. Reservation outbox publish

Ροή:

```text
scheduler-service
  -> reservation-service internal job: publish pending outbox events
       -> reservation-service publishes pending events to RabbitMQ
```

Suggested interval:

```text
every 30 seconds
```

Env:

```env
SCHEDULER_RESERVATION_OUTBOX_INTERVAL_SECONDS=30
```

#### 3. Analytics event drain + aggregate refresh

Ροή:

```text
scheduler-service
  -> analytics-service internal job: drain usage events
  -> analytics-service internal job: refresh aggregates
```

Intervals:

```text
drain events: every 30 seconds
refresh aggregates: every 5 minutes
```

Env:

```env
SCHEDULER_ANALYTICS_DRAIN_INTERVAL_SECONDS=30
SCHEDULER_ANALYTICS_REFRESH_INTERVAL_SECONDS=300
```

#### 4. Billing event drain

Ροή:

```text
scheduler-service
  -> billing-service internal job: drain billing events
          -> billing-service creates charges/invoice lines as appropriate
```

Interval:

```text
every 30 seconds
```

Env:

```env
SCHEDULER_BILLING_DRAIN_INTERVAL_SECONDS=30
```

### Τι να μη βάλουμε τώρα

Δεν θα έβαζα ακόμα:

```text
red-provider-worker
green-provider-worker
blue-provider-worker
```

εκτός αν το repo ήδη έχει ξεκάθαρη provider-local sync function που αξίζει να τρέχει ξεχωριστά.

Για πρώτη έκδοση, το καλύτερο είναι:

```text
catalog-service owns provider import orchestration
scheduler-service only triggers catalog import
```

Αν αργότερα δούμε ότι χρειάζεται provider-local scheduled snapshots, το προσθέτουμε.

### HTTP trigger ή RabbitMQ command;

Υπάρχουν δύο επιλογές.

#### Επιλογή 1 - scheduler calls internal HTTP endpoints

```text
scheduler-service -> POST http://catalog-service:8000/internal/jobs/import
```

Πλεονεκτήματα:

- απλούστερο,
- deterministic,
- εύκολο debug,
- ταιριάζει με Docker Compose,
- λιγότερος κώδικας,
- πιο κατάλληλο για το project τώρα.

Μειονεκτήματα:

- πιο άμεσο coupling,
- αν το service είναι κάτω, ο scheduler πρέπει να γράψει failed run και να retry later.

#### Επιλογή 2 - scheduler publishes RabbitMQ job commands

```text
scheduler-service -> RabbitMQ -> catalog-worker
```

Πλεονεκτήματα:

- πιο event-driven,
- καλύτερη αποσύζευξη,
- πιο production-like.

Μειονεκτήματα:

- περισσότερα contracts,
- command queues,
- consumers,
- idempotency,
- περισσότερη πολυπλοκότητα.

#### Recommendation

Για τώρα:

```text
Use internal HTTP job endpoints.
```

Το RabbitMQ να μείνει για domain/events propagation, όχι για scheduler commands στην πρώτη φάση.

Αυτό είναι πιο καθαρό, μικρότερο και λιγότερο risky.

### Πώς θα φαίνεται συνολικά

```text
Operator UI
   |
   v
Nginx gateway
   |
   v
scheduler-service
   |
   +--> catalog-service /internal/jobs/import
   |
   +--> reservation-service /internal/jobs/publish-outbox
   |
   +--> analytics-service /internal/jobs/drain-events
   |
   +--> analytics-service /internal/jobs/refresh-aggregates
   |
   +--> billing-service /internal/jobs/drain-events
```

Και παράλληλα:

```text
reservation-service -> RabbitMQ -> analytics-service / billing-service
```

Άρα κρατάμε:

- synchronous user actions,
- async event propagation,
- scheduled background triggering,
- service-owned execution.

### Τεχνικές αποφάσεις

#### Scheduler implementation

Θα χρησιμοποιούσα απλό Python FastAPI service με:

```text
FastAPI app
background scheduler loop
scheduler-postgres
SQLAlchemy/SQLModel
httpx for internal calls
```

Δεν είναι ανάγκη να βάλουμε Celery/Airflow/Temporal.

Για scheduling engine:

Προτίμηση:

```text
APScheduler
```

Γιατί δίνει καθαρό interval scheduling, job IDs, misfire handling και είναι γνωστό Python tool.

Αν θέλουμε ultra-minimal:

```text
asyncio loop
```

Αλλά για πιο "μηχανική" λύση, APScheduler είναι καλύτερο.

#### Minimum data model

`scheduled_jobs`

```text
id
name
target_service
target_url
method
interval_seconds
enabled
timeout_seconds
max_retries
created_at
updated_at
```

`job_runs`

```text
id
job_id
status
started_at
finished_at
duration_ms
http_status
error_message
attempt_count
```

Status values:

```text
PENDING
RUNNING
SUCCESS
FAILED
SKIPPED
```

#### Operator controls

Στο operator dashboard αξίζει να εμφανιστούν:

```text
Scheduled Jobs
- name
- enabled/disabled
- interval
- last run status
- last run time
- next run time
- manual run button
```

Για το Phase C implementation, μπορεί να είναι minimal.

### Τελική επιλογή

Η προσέγγιση που προτείνω είναι:

```text
Central scheduler-service with scheduler-postgres,
using internal HTTP job triggers,
while each target service owns and executes its own job logic.
```

Όχι:

```text
central orchestrator with business logic
```

Όχι:

```text
independent loops hidden inside every service only
```

### Πώς να το διατυπώσουμε για Codex

Το επόμενο prompt δεν πρέπει να ζητήσει implementation αμέσως. Πρώτα design-only:

```text
Design Phase C scheduler/control-plane implementation only.

We choose a hybrid architecture:
- central scheduler-service as control-plane;
- scheduler-postgres for job definitions and run history;
- internal HTTP job endpoints on responsible services;
- service-owned execution and data ownership;
- no business logic inside scheduler-service;
- no RabbitMQ for live user actions;
- no central database access to other service DBs.

Do not implement yet.

Produce:
1. proposed service/container changes;
2. exact jobs and intervals;
3. internal endpoints to add per service;
4. scheduler data model;
5. operator UI/API impact;
6. risks and mitigations;
7. affected files;
8. validation plan.

Update only AI logs:
- docs/ai/prompts/prompt_17_scheduler_design.md
- docs/ai/codex-runs/017-scheduler-design.md
- docs/ai/prompt-log.md

Do not modify application source code.
```

Μετά, αφού δούμε το design output, δίνουμε implementation prompt.
