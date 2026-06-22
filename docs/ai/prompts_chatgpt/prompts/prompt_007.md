# Prompt 007

Source PDF: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Build - Prompts 1-14.pdf`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Build - Prompts 1-14`

Source pages:

- Prompt: page 5
- Response: pages 6-7

Transcription note: The prompt is almost fully visible but its pasted Codex output is collapsed after the listed implementation summary. Only the visible text is transcribed; the response is complete.

## Prompt

Αυτό είναι το ανανεωμένο `.zip` του repo και η έξοδος του Codex:

COMPLETED

Υλοποιήθηκε το Prompt 02 baseline: `docker-compose.yml`, Nginx gateway, minimal Vite frontend placeholder, health-only FastAPI scaffolds για τα 10 canonical services, PostgreSQL ανά stateful service,

[The remaining Codex-output text is collapsed in the PDF export.]

## Response

Έλεγχος Prompt 02
Με βάση το νέο ZIP και την έξοδο του Codex, το Prompt 02 φαίνεται ολοκληρωμένο
σωστά.

Σημείο                                        Κατάσταση

docker-compose.yml                            ΟΚ

Nginx gateway                                 ΟΚ

Frontend placeholder                          ΟΚ

10 FastAPI service scaffolds                  ΟΚ

10 PostgreSQL containers                      ΟΚ

RabbitMQ                                      ΟΚ

Gateway health routes                         ΟΚ

docs/ai/codex-runs/002-docker-gateway.md      ΟΚ

docs/ai/prompt-log.md                         ΟΚ, Run 002 marked completed

Business logic accidentally added             Δεν φαίνεται

Blocker πριν το Prompt 03                     Κανένας ουσιαστικός

Η προειδοποίηση ότι το GitHub issue #2 παραμένει open είναι μη-blocking, αφού το
prompt απαγόρευε GitHub mutations.

Επόμενο prompt
Το επόμενο canonical prompt είναι:

  docs/ai/prompts/prompt_03_auth_service.md

Το αρχείο που πρέπει να βάλεις στο repo είναι εδώ:

Download prompt_03_auth_service.md

Αποθήκευσέ το ακριβώς στο:

  docs/ai/prompts/prompt_03_auth_service.md

Invocation prompt για Codex

    Επεξεργασία

 Read and execute docs/ai/prompts/prompt_03_auth_service.md.

 Follow AGENTS.md and docs/specs/SPECIFICATIONS.md.

 Use docs/ai/codex-runs/_template.md for the run report.

 Update docs/ai/codex-runs/003-auth-service.md and docs/ai/prompt-log.md.

 Record both the exact invocation prompt and the canonical task prompt file/content
 where practical.

 Implement only the auth-service scope defined in Prompt 03: local auth persistence,
 email/password login, JWT access tokens, refresh tokens, seeded demo users,
 role/provider scoping helpers, safe Google OAuth hook endpoints, tests,
 documentation, and validation.

 Do not implement frontend login screens, provider-registry business logic, provider
 adapters, catalog sync/search, status cache logic, reservation flow, analytics, billing,
 RabbitMQ business consumers, real secrets, GitHub issue/project mutations, or
 fallback Markdown project-management artifacts.
