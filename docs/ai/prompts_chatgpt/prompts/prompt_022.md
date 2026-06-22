# Prompt 022

Source PDF: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Build - Prompts 1-14.pdf`

PDF title: `NTUA - Τεχνολογίες Υπηρεσιών Λογισμικού - App Build - Prompts 1-14`

Source pages:

- Prompt: not exported; inferred from the response beginning on page 16
- Response: pages 16-17

Transcription note: **Speculative reconstruction, high confidence.** The response
directly answers which canonical prompts remain after Prompt 11 and explains their
scope. The prompt below is not verbatim.

## Prompt

Μετά το Prompt 11, ποια prompts απομένουν σύμφωνα με το υπάρχον canonical prompt
sequence του repo και τι θα κάνει το καθένα;

## Response

The planned remaining prompts are:

| Prompt | File | Purpose |
|---:|---|---|
| 12 | `docs/ai/prompts/prompt_12_frontend_ev_flows.md` | EV user frontend: login, map/search, point details, status lookup, reservation flow |
| 13 | `docs/ai/prompts/prompt_13_frontend_admin_dashboards.md` | Provider/admin and operator dashboards: analytics, billing, pricing, sync controls |
| 14 | `docs/ai/prompts/prompt_14_docs_uml_finalization.md` | Final documentation, PlantUML diagrams, README completion, final verification |

This matches the repo's `docs/ai/prompts/README.md` planned sequence.

### Practical interpretation

#### Prompt 12 - EV frontend flows

This should connect the existing backend into the first usable user-facing flow:

```text
login -> map/search -> point details -> status -> reserve -> my reservations
```

Expected scope:

- React + TypeScript + Vite frontend implementation.
- Auth/login state using existing `auth-service`.
- EV user pages/components.
- Catalog map/list/search through gateway only.
- Point details from `catalog-service`.
- Status lookup through `status-service`.
- Reservation creation/history through `reservation-service`.
- No provider/operator dashboards yet.

#### Prompt 13 - Admin/operator frontend dashboards

This should implement role-specific B2B/operator screens:

Provider dashboard:

- own provider analytics,
- usage logs/export,
- own invoices,
- mock invoice payment,
- provider settings/config visibility where appropriate.

Operator dashboard:

- global analytics,
- provider comparison,
- pricing-rule management,
- invoice issuance,
- sync/import controls,
- billing overview.

This should consume existing backend APIs, not create new architecture.

#### Prompt 14 - Finalization

This should be the final cleanup and delivery run:

- Final README pass.
- Final PlantUML diagrams under `docs/diagrams/final/`.
- Architecture documentation alignment.
- Verification matrix.
- End-to-end smoke documentation.
- AI logs completeness check.
- Final course-deliverable polish.

So after Prompt 11, the project shifts from backend/service implementation into frontend
integration, then final documentation/verification.
