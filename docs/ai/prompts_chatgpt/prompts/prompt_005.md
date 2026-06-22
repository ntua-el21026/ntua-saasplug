# Prompt 005

Source PDF: `NTUA--~4.PDF`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Audit - 2 and Docker Commands`

Source pages:

- Prompt: page 22
- Response: pages 22-28

## Prompt

Τι να κάνω τώρα που το ανοίγω για πρώτη φορά;

## Response

## Πρώτη εκκίνηση - κάνε αυτά με τη σειρά

### 1. Άνοιξε Docker Desktop

Περίμενε να γράφει ότι το Docker engine τρέχει. Αν είσαι σε WSL, βεβαιώσου ότι το Docker
Desktop έχει WSL integration ενεργό.

### 2. Πήγαινε στο root του repo

```bash
cd /home/peppasmich/NTUA-saasPlug
```

### 3. Έλεγξε ότι υπάρχει `.env`

```bash
ls -la .env .env.example
```

Θέλεις να υπάρχουν και τα δύο:

```text
.env
.env.example
```

Μην κάνεις `cat .env`, γιατί περιέχει secrets.

### 4. Έλεγξε ότι το `.env` δεν είναι tracked

```bash
git ls-files --error-unmatch .env
```

Αν βγάλει error τύπου:

```text
error: pathspec '.env' did not match any file(s) known to git
```

είναι σωστό. Σημαίνει ότι το `.env` δεν θα γίνει commit.

### 5. Έλεγξε Compose config χωρίς να τυπώσεις secrets

```bash
docker compose --env-file .env config --quiet
```

Αν δεν εμφανίσει τίποτα, είναι καλό.

Μην τρέχεις σκέτο:

```bash
docker compose config
```

γιατί μπορεί να εμφανίσει interpolated τιμές από `.env`.

### 6. Πρώτο build και start

Για πρώτη φορά, τρέξε:

```bash
docker compose --env-file .env up -d --build
```

Αυτό θα πάρει λίγη ώρα, γιατί θα χτίσει images για frontend και backend services.

### 7. Έλεγξε αν όλα έγιναν healthy

```bash
docker compose --env-file .env ps
```

Περίμενε να δεις τα containers σε `running` / `healthy`.

Αν κάποια services είναι ακόμα `starting`, περίμενε 30-60 δευτερόλεπτα και ξανατρέξε:

```bash
docker compose --env-file .env ps
```

## Άνοιγμα στον browser

Άνοιξε:

```text
http://localhost:8080/
```

Αυτό είναι το βασικό entrypoint της εφαρμογής. Το gateway εκτίθεται στο host port `8080`,
ενώ το frontend και τα backend services μένουν εσωτερικά.

Source referenced in the response: `docker-compose`

## Login

Χρησιμοποίησε demo user.

Operator:

```text
operator@saasplug.local
```

EV user:

```text
evuser@saasplug.local
```

Provider admins:

```text
red-admin@saasplug.local
green-admin@saasplug.local
blue-admin@saasplug.local
```

Password: χρησιμοποίησε την τιμή του `DEMO_USER_PASSWORD` από το `.env`. Αν δεν το
έχεις αλλάξει από το template, είναι:

```text
change-me-demo-password
```

## Πρώτη πρακτική ενέργεια μέσα στην εφαρμογή

Αφού μπεις ως operator:

```text
http://localhost:8080/operator/sync
```

Τρέξε τα provider-specific catalog imports:

```text
catalog.import.red
catalog.import.green
catalog.import.blue
```

Αυτό γεμίζει το catalog με live provider data. Είναι προτιμότερο από το bulk
`catalog.import.all`, επειδή στο τελευταίο live verification το bulk import είχε timeout, ενώ
τα τρία provider-specific jobs πέρασαν και γέμισαν σωστά το catalog.

Μετά πήγαινε ως EV user στο:

```text
http://localhost:8080/map
```

και έλεγξε ότι εμφανίζονται charging points.

## Γρήγορα health checks

Σε δεύτερο terminal:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/catalog/health
curl http://localhost:8080/api/scheduler/health
```

Πρέπει να επιστρέφουν επιτυχή responses.

## Αν κάτι δεν ανοίγει

### Δες containers

```bash
docker compose --env-file .env ps
```

### Δες logs gateway

```bash
docker compose --env-file .env logs --tail=100 nginx-gateway
```

### Δες logs frontend

```bash
docker compose --env-file .env logs --tail=100 frontend
```

### Δες logs scheduler

```bash
docker compose --env-file .env logs --tail=100 scheduler-service
```

### Δες logs catalog

```bash
docker compose --env-file .env logs --tail=100 catalog-service
```

Αν ένα service κόλλησε:

```bash
docker compose --env-file .env restart <service-name>
```

Παράδειγμα:

```bash
docker compose --env-file .env restart catalog-service
```

## Κλείσιμο όταν τελειώσεις

Για καθημερινό κλείσιμο:

```bash
docker compose --env-file .env down
```

Αυτό δεν διαγράφει δεδομένα.

Μην χρησιμοποιήσεις τώρα:

```bash
docker compose --env-file .env down -v
```

Το `-v` διαγράφει volumes, δηλαδή local βάσεις, imports, reservations, invoices, analytics,
RabbitMQ data.

## Η σημερινή σωστή σειρά

```bash
cd /home/peppasmich/NTUA-saasPlug
docker compose --env-file .env config --quiet
docker compose --env-file .env up -d --build
docker compose --env-file .env ps
```

Μετά άνοιξε:

```text
http://localhost:8080/
```

Μπες ως operator, τρέξε:

```text
catalog.import.red
catalog.import.green
catalog.import.blue
```

Μετά δοκίμασε ως EV user:

```text
http://localhost:8080/map
```

Κλείσιμο:

```bash
docker compose --env-file .env down
```
