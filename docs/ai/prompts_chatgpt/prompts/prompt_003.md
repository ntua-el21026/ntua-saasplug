# Prompt 003

Source PDF: `NTUA--~1.PDF`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - Initial Prompt, Specs, Repo Audit and Setup`

Source pages:

- Prompt: page 12
- Response: pages 15-25

## Prompt

Να διαβάσεις αυτό.
Έπειτα, πάμε να τα αποφασίσουμε όλα από την αρχή.

## Response

## SPEC-2 - Provider API & Data Acquisition Strategy

Σκοπός του SPEC-2 είναι να κλειδώσουμε πώς θα παίρνουμε, αποθηκεύουμε,
συγχρονίζουμε και χρησιμοποιούμε τα δεδομένα των providers.

Η διάλεξη για την εργασία θέτει ρητά τα ανοιχτά αρχιτεκτονικά θέματα: live API calls ή
local DB, αν υπάρχει local DB πώς ενημερώνονται τα points, πότε γίνονται API calls,
πόσα microservices, data sync strategy, RabbitMQ και orchestration.

Οι σημειώσεις σου δίνουν ισχυρή κατεύθυνση: δεν κάνουμε συνεχώς calls στους providers
για όλα· κρατάμε αποθήκη δεδομένων σημείων, περιοδικά συγχρονισμένη, και κάνουμε live
calls κυρίως για status και reservation.

Sources referenced in the response:

- `12.2 Συζήτηση για εργασία`
- `Project Notes from Lectures`

### SPEC-2A - High-level strategy

#### Proposed decision

Χρησιμοποιούμε hybrid provider strategy:

| Λειτουργία | Στρατηγική |
|---|---|
| Charging point catalog/list | Local DB, ενημερώνεται περιοδικά από provider APIs |
| Search/filter | Από local aggregated catalog |
| Point details | Από local catalog + optional fresh status |
| Live status | Real-time provider API call μέσω backend, με short cache |
| Reservation | Real-time provider API call μέσω backend, χωρίς queue μπροστά |
| Analytics/billing | Από δικά μας stored events/records, όχι live από providers |

#### Rationale

Αυτό υλοποιεί ακριβώς τη λογική των σημειώσεων:

- τα list/catalog calls είναι τα πιο "βαριά", άρα δεν τα κάνουμε για κάθε χρήστη,
- τα status και reservation είναι τα δύο απαραίτητα real-time calls,
- το frontend δεν καλεί απευθείας provider APIs,
- το σύστημα αποκτά δικά του δεδομένα για search, analytics και billing.

#### Status

`proposed`

### SPEC-2B - Provider-specific microservices

#### Proposed decision

Θα έχουμε ένα provider integration microservice ανά provider:

| Service | Ευθύνη |
|---|---|
| `red-provider-service` | integration με redPlug API |
| `green-provider-service` | integration με greenPlug API |
| `blue-provider-service` | integration με bluePlug API |

Κάθε provider service θα ξέρει μόνο:

- το external API schema του provider,
- τα external endpoints,
- πώς μετατρέπεται η απάντηση σε normalized internal model,
- πώς γίνεται status lookup,
- πώς γίνεται reservation.

Τα υπόλοιπα services δεν πρέπει να ξέρουν αν το πεδίο λέγεται `pointid`, `id`,
`chargerId`, `state`, `currentStatus`, κ.λπ.

#### Για νέο provider

Αν προστεθεί νέος provider, προστίθεται νέο provider service:

```text
yellow-provider-service
```

χωρίς να χρειαστεί να αλλάξει όλο το σύστημα.

#### Status

`proposed`

### SPEC-2C - Aggregated catalog service

#### Proposed decision

Θα υπάρχει ξεχωριστό service:

```text
charging-catalog-service
```

ή:

```text
catalog-aggregator-service
```

Το service αυτό κρατά το ενιαίο normalized catalog όλων των charging points από
red/green/blue.

#### Ευθύνες

| Ευθύνη | Περιγραφή |
|---|---|
| Store normalized points | αποθηκεύει όλα τα σημεία σε κοινό schema |
| Search/filter API | εξυπηρετεί το frontend για αναζήτηση |
| Provider filtering | φιλτράρισμα ανά provider |
| Staleness tracking | κρατά `last_catalog_sync_at`, `last_status_checked_at` |
| Missing data handling | εμφανίζει σωστά missing price/status |
| Manual sync visibility | δείχνει πότε έγινε τελευταίος συγχρονισμός |

#### Internal ID strategy

Κλειδώνουμε ότι το εσωτερικό ID ενός φορτιστή δεν είναι απλώς το external provider ID.

Χρησιμοποιούμε:

```text
provider_code + external_point_id
```

Παράδειγμα:

```text
redPlug:12345
greenPlug:12345
bluePlug:12345
```

ώστε να μην έχουμε collisions.

#### Status

`proposed`

### SPEC-2D - Catalog synchronization policy

#### Proposed decision

Ο συγχρονισμός του catalog γίνεται περιοδικά και χειροκίνητα για demo/debug.

| Trigger | Απόφαση |
|---|---|
| Automatic sync | Ναι |
| Default frequency | 1 φορά την ημέρα |
| Manual sync from operator dashboard | Ναι |
| Sync on first system startup | Ναι, αν το catalog είναι άδειο |
| Retry policy | Ναι, λίγες επαναλήψεις με backoff |
| Live sync per user search | Όχι |

#### Upsert strategy

Επιλέγουμε την απλή και robust πολιτική:

> Κάθε provider sync φέρνει όλα τα σημεία του provider και το catalog service κάνει full
> upsert with change detection.

Δηλαδή:

- αν το point υπάρχει, ενημερώνεται,
- αν είναι νέο, εισάγεται,
- αν λείπει από νέο sync, δεν διαγράφεται άμεσα· μαρκάρεται ως `stale` ή `inactive`,
- κρατάμε timestamp τελευταίας εμφάνισης.

Αποφεύγουμε να υπολογίζει κάθε provider service πολύπλοκα diffs. Το diff/change
detection γίνεται κεντρικά στο catalog service.

#### Status

`proposed`

### SPEC-2E - RabbitMQ usage για provider sync

#### Proposed decision

Χρησιμοποιούμε RabbitMQ μόνο για ασύγχρονα sync/background flows, όχι για live
frontend actions.

Για catalog sync:

```text
scheduler/operator
         |
         v
RabbitMQ: provider.sync.requested
         |
         +--> red-provider-service
         +--> green-provider-service
         +--> blue-provider-service
                  |
                  v
RabbitMQ: provider.points.fetched
                  |
                  v
catalog-aggregator-service
                  |
                  v
catalog database
```

Δεν χρησιμοποιούμε RabbitMQ για:

| Flow | Απόφαση |
|---|---|
| Search request | Όχι |
| View details request | Όχι |
| Live status request | Όχι |
| Reservation request | Όχι |
| Login/auth | Όχι |

#### Rationale

Οι σημειώσεις λένε ότι το messaging δεν πρέπει να χρησιμοποιηθεί για αιτήσεις του
frontend και ότι ο κλασικός λόγος χρήσης του είναι συγχρονισμός βάσεων/δεδομένων.

Source referenced in the response: `Project Notes from Lectures`

#### Status

`proposed`

### SPEC-2F - Live status strategy

#### Proposed decision

Το live status γίνεται μέσω:

```text
frontend
  -> api-gateway
  -> charging-status-service
  -> provider-specific service
  -> external provider API
```

Το `charging-status-service`:

- δέχεται `internal_point_id`,
- βρίσκει provider και external ID,
- ελέγχει short cache,
- αν το cache είναι fresh, επιστρέφει cached status,
- αλλιώς καλεί το αντίστοιχο provider service,
- αποθηκεύει `last_known_status` και `last_status_checked_at`.

#### Cache TTL

Προτεινόμενη απλή τιμή:

```text
60 seconds
```

Αυτό είναι αρκετά μικρό για να φαίνεται "live" στο demo, αλλά αποφεύγει συνεχείς
επαναλαμβανόμενες κλήσεις.

#### Status values

Κλειδώνουμε εσωτερικό normalized enum:

```text
available
charging
reserved
malfunction
offline
unknown
```

Αν provider επιστρέψει άγνωστο ή missing status, κάνουμε map σε:

```text
unknown
```

#### Status

`proposed`

### SPEC-2G - Reservation strategy

#### Proposed decision

Η κράτηση γίνεται real-time και synchronously.

Flow:

```text
frontend
  -> api-gateway
  -> reservation-service
  -> provider-specific service
  -> external provider reservation endpoint
```

#### Κανόνας

Δεν βάζουμε queue πριν από το reservation call.

Ο λόγος είναι ότι ο χρήστης χρειάζεται άμεση απάντηση:

- κράτηση επιτυχής,
- κράτηση αποτυχημένη,
- provider unavailable,
- invalid point/status,
- timeout.

#### Τι αποθηκεύουμε

Το reservation-service αποθηκεύει:

| Field | Περιγραφή |
|---|---|
| reservation id | εσωτερικό ID |
| user id | EV user |
| provider code | red/green/blue |
| external point id | provider point |
| internal point id | normalized ID |
| requested duration | αν υπάρχει |
| provider response | normalized result |
| status | `successful`, `failed`, `pending_external_unknown` |
| reservation end time | αν δοθεί |
| error reason | αν αποτύχει |
| created at | timestamp |

Μετά την καταγραφή, τα δεδομένα μπορούν να πάνε σε analytics/billing με event ή
περιοδικό sync. Δεν επηρεάζεται η άμεση απάντηση στον χρήστη.

#### Status

`proposed`

### SPEC-2H - Missing values, timeouts, fallback

#### Proposed decision

Κλειδώνουμε απλή αλλά συστηματική πολιτική.

| Περίπτωση | Συμπεριφορά |
|---|---|
| Missing price | Εμφάνιση `Price unavailable` |
| Previously known price exists | Μπορούμε να δείξουμε `Last known price` με timestamp |
| Missing status | `unknown` |
| Provider timeout στο status | επιστροφή last known status, αν υπάρχει, με warning |
| Provider timeout στο reservation | αποτυχημένη προσπάθεια, καταγραφή error |
| Provider API 400/404/500 | normalized error response |
| Sync failure | καταγραφή failed sync run, retry, διατήρηση παλιού catalog |

#### Frontend messages

Δεν εμφανίζουμε raw provider errors στον χρήστη. Εμφανίζουμε καθαρά μηνύματα:

```text
Status temporarily unavailable. Showing last known information.
```

```text
Reservation could not be completed because the provider did not respond.
```

#### Status

`proposed`

### SPEC-2I - External API visibility / gateway rule

#### Proposed decision

Κανένα browser request δεν πηγαίνει απευθείας:

- σε provider API,
- σε internal microservice port,
- σε raw Docker service URL.

Όλα περνούν από:

```text
frontend -> gateway/reverse proxy -> backend services
```

Αυτό ταιριάζει με τις σημειώσεις για το πρόβλημα του browser inspect και την ανάγκη να μη
φαίνονται απευθείας URLs/ports.

Source referenced in the response: `Project Notes from Lectures`

#### Status

`proposed`

### SPEC-2 - Συνολική πρόταση

#### Proposed accepted decision

| Πεδίο | Απόφαση |
|---|---|
| Overall strategy | Hybrid |
| Catalog/list points | Local aggregated catalog |
| Catalog update | Periodic full upsert with change detection |
| Default sync frequency | Daily |
| Manual sync | Ναι, από operator |
| Provider services | Ένα ανά provider |
| Aggregator/catalog service | Ναι |
| Status | Real-time μέσω backend + 60s cache |
| Reservation | Real-time synchronous, no queue |
| RabbitMQ | Μόνο για background sync/background propagation |
| Missing values | explicit fallback policy |
| Frontend direct provider calls | Απαγορεύονται |
| API gateway/reverse proxy | Υποχρεωτικό στο runtime design |

Status: `proposed`

### Απόφαση που χρειάζεται τώρα

Να κλειδώσουμε το SPEC-2 ως έχει ή να αλλάξουμε κάποιο από τα παρακάτω;

| Θέμα | Τρέχουσα πρόταση |
|---|---|
| Provider strategy | Hybrid |
| Provider services | 3 services, ένα ανά provider |
| Catalog storage | Local aggregated catalog |
| Catalog sync | Daily + manual + first-start |
| Sync policy | Full upsert with change detection |
| RabbitMQ | Μόνο για background sync |
| Status cache | 60 seconds |
| Reservation | Real-time, no queue |
| Frontend provider calls | Όχι, όλα μέσω gateway/backend |
