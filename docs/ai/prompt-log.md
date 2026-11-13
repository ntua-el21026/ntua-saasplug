# AI Prompt Log

This file is the central index of ChatGPT/Codex-assisted implementation runs for the saasPlug project.

The official AI logging subsystem is considered unavailable for this project. Therefore, AI usage is documented manually in the repository through this prompt log and the per-run files under `docs/ai/codex-runs/`.

---

## Status legend

| Status | Meaning |
|---|---|
| `planned` | Prompt exists or is planned but has not been executed |
| `in-progress` | Prompt has been given to Codex and is being worked on |
| `completed` | Run finished and acceptance criteria passed |
| `partial` | Run finished but some acceptance criteria or checks remain unresolved |
| `failed` | Run could not complete |
| `superseded` | Run was replaced by a later run |

---

## Prompt/run index

| Run ID | Date | Invocation Type | Canonical Prompt File | Purpose | Status | Run Report |
|---:|---|---|---|---|---|---|
| 000 | 2026-06-11 | Direct audit prompt | none | Repository/spec/course-source/GitHub readiness audit | `completed` | `docs/ai/codex-runs/000-audit-only.md` |
| 00B | 2026-06-11 | Direct setup prompt saved as canonical prompt | `docs/ai/prompts/prompt_00b_logging_and_github_setup.md` | Logging workflow and GitHub project setup | `completed_with_warnings` | `docs/ai/codex-runs/00B-logging-and-github-setup.md` |
| 001 | 2026-06-11 | Canonical prompt invocation | `docs/ai/prompts/prompt_01_repo_foundation.md` | Repository foundation | `completed` | `docs/ai/codex-runs/001-repo-foundation.md` |
| 002 | 2026-06-11 | Canonical prompt invocation | `docs/ai/prompts/prompt_02_docker_gateway.md` | Docker Compose baseline and Nginx gateway | `completed` | `docs/ai/codex-runs/002-docker-gateway.md` |
| 003 | 2026-06-11 | Canonical prompt invocation | `docs/ai/prompts/prompt_03_auth_service.md` | Auth service | `completed` | `docs/ai/codex-runs/003-auth-service.md` |
| 004 | 2026-06-11 | Canonical prompt invocation | `docs/ai/prompts/prompt_04_provider_registry_service.md` | Provider registry service | `completed` | `docs/ai/codex-runs/004-provider-registry-service.md` |
| 005 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_05_provider_services.md` | red/green/blue provider services | `completed` | `docs/ai/codex-runs/005-provider-services.md` |
| 006 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_06_catalog_service.md` | Catalog service | `completed_with_warnings` | `docs/ai/codex-runs/006-catalog-service.md` |
| 007 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_07_status_service.md` | Status service | `completed_with_warnings` | `docs/ai/codex-runs/007-status-service.md` |
| 008 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_08_reservation_service.md` | Reservation service | `completed` | `docs/ai/codex-runs/008-reservation-service.md` |
| 009 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_09_rabbitmq_event_infrastructure.md` | RabbitMQ event infrastructure | `completed` | `docs/ai/codex-runs/009-rabbitmq-event-infrastructure.md` |
| 010 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_10_analytics_service.md` | Analytics service | `completed` | `docs/ai/codex-runs/010-analytics-service.md` |
| 011 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_11_billing_service.md` | Billing service | `completed` | `docs/ai/codex-runs/011-billing-service.md` |
| 012 | 2026-06-12 | Canonical prompt invocation | `docs/ai/prompts/prompt_12_frontend_ev_flows.md` | EV frontend flows | `completed_with_warnings` | `docs/ai/codex-runs/012-frontend-ev-flows.md` |
| 013 | 2026-06-13 | Canonical prompt invocation | `docs/ai/prompts/prompt_13_provider_operator_dashboards.md` | Provider and operator frontend dashboards | `completed_with_warnings` | `docs/ai/codex-runs/013-provider-operator-dashboards.md` |
| 014 | 2026-06-13 | Canonical prompt invocation | `docs/ai/prompts/prompt_14_final_docs_uml.md` | Final documentation and UML finalization | `completed_with_warnings` | `docs/ai/codex-runs/014-final-docs-uml.md` |
| 015 | 2026-06-13 | Canonical prompt invocation | `docs/ai/prompts/prompt_15_finalization_project_audit.md` | Finalization project setup and Phase A repository audit | `completed_with_warnings` | `docs/ai/codex-runs/015-finalization-project-audit.md` |
| 016 | 2026-06-13 | Canonical prompt invocation | `docs/ai/prompts/prompt_16_live_env_verification.md` | Live environment and provider contract verification | `completed_with_warnings` | `docs/ai/codex-runs/016-live-env-verification.md` |
| 017 | 2026-06-13 | Direct design prompt saved as canonical prompt | `docs/ai/prompts/prompt_17_scheduler_design.md` | Phase C scheduler control-plane design | `completed` | `docs/ai/codex-runs/017-scheduler-design.md` |
| 018 | 2026-06-13 | Canonical prompt invocation | `docs/ai/prompts/prompt_18_scheduler_control_plane_implementation.md` | Phase C scheduler control-plane implementation | `completed_with_warnings` | `docs/ai/codex-runs/018-scheduler-control-plane-implementation.md` |
| 018H | 2026-06-14 | Direct hardening continuation | N/A | Phase C gateway internal-job exposure hardening | `completed` | `docs/ai/codex-runs/018-scheduler-control-plane-implementation.md` |
| 019 | 2026-06-14 | Direct prompt saved as canonical prompt | `docs/ai/prompts/prompt_19_phase_d_test_expansion.md` | Phase D application test expansion | `completed` | `docs/ai/codex-runs/019-phase-d-test-expansion.md` |
| 020 | 2026-06-14 | Direct continuation prompt | N/A | Comprehensive Phase D test expansion and final project closure | `completed_with_warnings` | `docs/ai/codex-runs/020-comprehensive-test-expansion-and-project-closure.md` |
| 021 | 2026-06-14 | Canonical prompt invocation plus user-directed GitHub project setup | `docs/ai/prompts/prompt_21_final_verification_only.md` | Final verification-only audit and final audit/documentation project setup | `completed_with_warnings` | `docs/ai/codex-runs/021-final-verification-only.md` |
| 022 | 2026-06-14 | Canonical prompt invocation | `docs/ai/prompts/prompt_22_live_env_full_verification.md` | Live `.env` full verification, live provider reads, gateway smokes, and Project #3 audit closure | `completed_with_warnings` | `docs/ai/codex-runs/022-live-env-full-verification.md` |
| 023 | 2026-06-14 | Canonical prompt invocation | `docs/ai/prompts/prompt_23_readme_documentation_polish.md` | Repository-wide README documentation polish and Project #3 documentation task closure | `completed_with_warnings` | `docs/ai/codex-runs/023-readme-documentation-polish.md` |
| 024 | 2026-06-14 | Canonical prompt invocation | `docs/ai/prompts/prompt_24_frontend_design_system_redesign.md` | Frontend design-system redesign and live visual QA | `completed_with_warnings` | `docs/ai/codex-runs/015-frontend-design-system-redesign.md` |
| 025 | 2026-06-15 | Direct continuation prompt | N/A | Frontend MapLibre/OpenFreeMap charging-map integration | `completed_with_warnings` | `docs/ai/codex-runs/025-frontend-maplibre-integration.md` |
| 026 | 2026-06-15 | Direct screenshot prompt | N/A | Login screen provider-entry polish and operator-only provider registration routing | `completed_with_warnings` | `docs/ai/codex-runs/026-login-provider-entry-polish.md` |
| 027 | 2026-06-15 | Direct bugfix prompt | N/A | Provider page crash fixes and map marker/radius visibility | `completed_with_warnings` | `docs/ai/codex-runs/027-frontend-provider-map-fixes.md` |
| 028 | 2026-06-15 | Direct screenshot/continuation prompt | N/A | Frontend map viewport fit, redundant-header removal, and landing/login polish | `completed_with_warnings` | `docs/ai/codex-runs/028-frontend-responsive-polish.md` |
| 029 | 2026-06-15 | Direct screenshot/continuation prompt | N/A | Catalog radius filtering, role badges, and RabbitMQ/cache audit | `completed_with_warnings` | `docs/ai/codex-runs/029-map-radius-role-events.md` |
| 030 | 2026-06-15 | Direct corrective screenshot prompt | N/A | Map radius render guard, provider-colored markers, and fetch cap responsiveness | `completed_with_warnings` | `docs/ai/codex-runs/030-map-radius-marker-correction.md` |
| 031 | 2026-06-15 | Direct corrective clarification | N/A | Exact API-side catalog circle filtering before pagination | `completed_with_warnings` | `docs/ai/codex-runs/031-catalog-api-circle-filtering.md` |
| 032 | 2026-06-15 | Direct implementation prompt | N/A | Live usage/status/catalog events, scheduler cadence updates, and operator schedule editing | `completed_with_warnings` | `docs/ai/codex-runs/032-event-scheduler-cadence-and-operator-controls.md` |
| 033 | 2026-06-15 | Direct corrective continuation | N/A | Viewport-derived map search radius and all-in-circle catalog rendering | `completed_with_warnings` | `docs/ai/codex-runs/033-viewport-derived-map-radius.md` |
| 034 | 2026-06-15 | Direct continuation prompt | N/A | Ordered scheduler maintenance run action for operators | `completed_with_warnings` | `docs/ai/codex-runs/034-ordered-scheduler-maintenance-run.md` |
| 035 | 2026-06-22 | Direct UI polish continuation | N/A | Signed-in UI text polish, reservation copy cleanup, brand slogan, and app mark update | `completed` | `docs/ai/codex-runs/035-ui-brand-and-reservation-polish.md` |
| 036 | 2026-06-22 | Direct question prompt | N/A | Current EV tariff and provider billing price computation answer | `completed` | `docs/ai/codex-runs/036-current-price-computation-answer.md` |
| 037 | 2026-06-22 | Direct planning/question prompt | N/A | EV cost label terminology and analytics queue cadence explanation | `completed` | `docs/ai/codex-runs/037-ev-cost-label-and-analytics-cadence.md` |
| 038 | 2026-06-22 | Direct implementation prompt | N/A | EV-only Google sign-in, password changes, and profile copy polish | `completed_with_warnings` | `docs/ai/codex-runs/038-google-ev-password-profile.md` |
| 039 | 2026-06-22 | Direct implementation prompt | N/A | EV reservation cost estimates and analytics summary aggregates | `completed_with_warnings` | `docs/ai/codex-runs/039-ev-reservation-cost-analytics.md` |
| 040 | 2026-06-23 | Direct bugfix prompt | N/A | Nginx gateway runtime DNS resolution after container rebuilds | `completed_with_warnings` | `docs/ai/codex-runs/040-nginx-runtime-dns-gateway-paths.md` |
| 041 | 2026-06-23 | Direct UI polish and bugfix prompt | N/A | Provider filter card polish, user-facing admin copy, and provider-owned point access | `completed_with_warnings` | `docs/ai/codex-runs/041-provider-filter-and-point-access-polish.md` |
| 042 | 2026-06-23 | Direct corrective implementation prompt | N/A | Provider catalog point list scope enforcement | `completed_with_warnings` | `docs/ai/codex-runs/042-provider-catalog-scope-enforcement.md` |
| 043 | 2026-06-23 | Direct UI bugfix and polish prompt | N/A | Login shortcuts, EV point-list visibility, reservation duration editing, and dismissible messages | `completed_with_warnings` | `docs/ai/codex-runs/043-login-map-reservation-message-polish.md` |
| 044 | 2026-06-23 | Direct GitHub project and UI polish prompt | N/A | UI Final Polish project setup, logout confirmation, provider refresh controls, and Google OAuth callback fix | `completed` | `docs/ai/codex-runs/044-ui-final-polish-pass-1.md` |
| 045 | 2026-06-23 | Direct UI polish prompt | N/A | UI Final Polish pass 2 logout modal and reservation history scrolling/presets | `completed` | `docs/ai/codex-runs/045-ui-final-polish-pass-2.md` |
| 046 | 2026-06-23 | Direct UI polish prompt | N/A | UI Final Polish pass 3 provider pages, analytics date ranges, and title styling | `completed` | `docs/ai/codex-runs/046-ui-final-polish-pass-3.md` |
| 047 | 2026-06-23 | Direct UI polish prompt | N/A | UI Final Polish pass 4 metric-card typography alignment | `completed` | `docs/ai/codex-runs/047-ui-final-polish-pass-4.md` |
| 048 | 2026-06-23 | Direct UI polish prompt | N/A | Operator sync and catalog health polish | `completed_with_warnings` | `docs/ai/codex-runs/048-operator-sync-catalog-health-polish.md` |
| 049 | 2026-06-24 | Direct UI polish and project closure prompt | N/A | EV reservations scroll polish and UI Final Polish project closure | `completed` | `docs/ai/codex-runs/049-ev-reservations-scroll-and-project-closure.md` |
| 050 | 2026-06-24 | Direct UI polish prompt | N/A | Final UI polish for date filters, centered actions, and operator overview tabs | `completed` | `docs/ai/codex-runs/050-final-ui-polish-date-actions-operator-tabs.md` |
| 051 | 2026-06-24 | Direct implementation prompt from attached text | N/A | Verified audit fixes safe finalization pass | `completed_with_warnings` | `docs/ai/codex-runs/051-verified-audit-fixes-safe-finalization.md` |
| 052 | 2026-06-24 | Direct implementation prompt | N/A | Frontend reservation retry idempotency-key lifecycle correction | `completed` | `docs/ai/codex-runs/052-frontend-reservation-retry-idempotency.md` |
| 053 | 2026-06-24 | Direct implementation prompt | N/A | Operator scheduler interval preset controls | `completed_with_warnings` | `docs/ai/codex-runs/053-operator-scheduler-interval-presets.md` |
| 053 | 2026-06-24 | Direct implementation prompt from attached text plus user clarification | N/A | Final audit fixes F-001 through F-018, runtime validation, and password shortcut preservation | `completed_with_warnings` | `docs/ai/codex-runs/053-final-audit-fixes-f001-f018.md` |
| 054 | 2026-06-24 | Direct auth landing UI polish prompt | N/A | Auth hero image, EV-user commercial copy, role shortcut heading, and password guidance cleanup | `completed_with_warnings` | `docs/ai/codex-runs/054-auth-landing-hero-polish.md` |
| 055 | 2026-06-24 | Direct implementation prompt plus follow-up | N/A | Reservation/status consistency, operator-controlled cache TTL, profile password visibility, and revenue chart currency formatting | `completed` | `docs/ai/codex-runs/055-status-cache-consistency-and-profile-polish.md` |
| 056 | 2026-06-24 | Direct frontend workflow and landing polish prompt | N/A | Operator catalog import progress, minimal image-led landing page, and map viewport persistence | `completed` | `docs/ai/codex-runs/056-catalog-progress-landing-map-viewport.md` |
| 057 | 2026-06-25 | Direct UI and analytics/pricing prompt plus follow-up | N/A | EV map fullscreen mode, pricing rule switches, split landing hero, and point views by status analytics | `completed` | `docs/ai/codex-runs/057-map-fullscreen-pricing-status-views.md` |
| 058 | 2026-06-25 | Direct landing polish prompt | N/A | Remove landing kicker and lower the split hero below the header | `completed` | `docs/ai/codex-runs/058-landing-hero-spacing.md` |
| 059 | 2026-06-25 | Direct map controls polish prompt plus analytics clarification | N/A | Remove custom map pan/zoom pad, restyle fullscreen as right-side icon control, and clarify point-view status chart behavior | `completed` | `docs/ai/codex-runs/059-map-controls-polish.md` |
| 060 | 2026-06-25 | Direct product-logic update prompt | N/A | Treat EV map/list quick-view opens as billable and analytic point views | `completed` | `docs/ai/codex-runs/060-map-quick-view-point-events.md` |
| 060 | 2026-06-25 | Direct operator pricing UI prompt | N/A | Operator pricing page tabs and pricing policy sentence removal | `completed` | `docs/ai/codex-runs/060-operator-pricing-tabs.md` |
| 061 | 2026-06-25 | Direct provider points filter prompt | N/A | Provider charging-points filter card and analytics metric explanation | `completed` | `docs/ai/codex-runs/061-provider-points-filters.md` |
| 062 | 2026-06-25 | Direct invoices and sync UI prompt | N/A | Remove duplicate invoice provider filter and sync manual-operations tab | `completed` | `docs/ai/codex-runs/062-invoices-and-sync-dedup-polish.md` |
| 063 | 2026-06-25 | Direct attached final UML audit prompt | N/A | Final UML diagram audit and code-derived correction | `completed` | `docs/ai/codex-runs/063-final-diagram-audit-and-correction.md` |
| 064 | 2026-06-25 | Direct attached README audit prompt | N/A | Final README audit, concise updates, and missing scripts/postman README | `completed` | `docs/ai/codex-runs/064-readme-audit-and-update.md` |
| 065 | 2026-06-25 | Direct Markdown lint setup prompt | N/A | Project Markdown lint configuration and runner | `completed` | `docs/ai/codex-runs/065-markdown-lint-configuration.md` |

---

## Governance rules

1. Every Codex implementation run must have a row in this file.
2. Every Codex implementation run must have a corresponding run log under `docs/ai/codex-runs/`.
3. The run log must record the prompt received, files changed, tests/checks run, results, and limitations.
4. If a Codex run changes architecture-relevant files, the run log must explicitly state whether the changes conform to `docs/specs/SPECIFICATIONS.md`.
5. Failed GitHub CLI/API project-management actions must be reported as failures, not replaced with fallback Markdown project artifacts unless explicitly requested.
6. This file must be updated in the same run that performs the implementation work.

---

## Notes

- This log does not automatically capture the full ChatGPT planning conversation.
- Planning decisions are consolidated in `docs/specs/SPECIFICATIONS.md`.
- Implementation prompts are stored in `docs/ai/prompts/`.
- Run reports are stored in `docs/ai/codex-runs/`.


## 2026-11-12 – Local portfolio preparation

Invocation excerpts supplied by the parent task: “Make the necessary local
corrections, including targeted code changes where justified. Do not undertake
unrelated refactoring or redesign working systems.” and “At this stage, I
authorize local preparation and validation only.” Follow-up: “Continue and finish
your work”. No canonical prompt file. Scope: private template cleanup, local
network/activity defaults, focused regressions, setup/attribution documentation,
and offline validation; no remote or publication actions.

[Run report](codex-runs/20261112-local-portfolio-preparation.md) records the scoped
authorization, changes, actual test outcomes, Python 3.14 dependency failure,
Python 3.12 auth validation, Docker limitation, and owner rotation follow-up.

## 2026-11-13 – Portfolio documentation refinement

Delegated campaign invocation (exact):

```text
Implement batch 2 portfolio documentation in fresh clones ONLY under /home/peppasmich/projects/portfolio-docs-20261113-2P6YZN. Read task-specification.txt there fully and repository-inventory.json. Assigned ntua-pulse-university, ntua-connectune, ntua-toll-busters, ntua-clearsky, ntua-saasplug. Clone git --depth 1 --filter=blob:none --single-branch HTTPS GIT_LFS_SKIP_SMUDGE=1. Inspect instructions AGENTS, README/docs representative source/config/scripts/tests before edits. Improve English README/docs, grounded in actual implementation; team contributions, practical setup/config and paths, implemented vs prototype/mock status, service requirements. Preserve attribution, license and evidence; don't modify source/dependencies/CI. User specifically asks SQL/data/CLI/admin for Pulse; Flutter HCI workflows for connectune; Express/MySQL API CLI frontend and invalid-date pooled connection issue report for toll-busters; actual microservices, grade/stats/review for clearsky, existing postGrades behavior out of scope; EV reservations provider analytics microservices mock billing for saasplug. Inspect external links/assets for self-containment and stale repo URLs. Validate static links/images/anchors/commands/env names/diff --check; no app services/major dependency installs. DO NOT PUSH or remote branch; root checks integrations/delivery. May commit coherent docs commit per repo after review. Record detailed workspace/batch2-result.json listing initial/local SHA, changed files, summary, external resources/retrieval/blockers, exact validations outcomes, representative source inspected, authorship/license preserved. Do not edit other repositories or shared progress JSON. Continue all five automatically.
```

No canonical repository prompt file was used. The full user campaign task was
provided externally as `task-specification.txt` (SHA-256 `8ff35ff04d5891db007611d1f9a10476b0558674fd6ab07eda2300a6d31a18b8`)
and covers 35 repositories. [Run report](codex-runs/20261113-portfolio-documentation.md)
records source inspection, documentation-only changes, three passed offline
configuration checks, three skipped live gateway cases, static validation,
service/access limitations, and parent-controlled delivery.

### 2026-11-13 – Portable PlantUML path follow-up

Exact delegated invocation:

```text
Both active path leftovers are in scope to correct. Please fix saasplug's maintained PlantUML README (not raw professor .puml materials): use canonical sibling clone linkage and portable JAR path/config, clearly specify working directory; preserve attribution/notices. Update this task's existing docs/ai prompt/run logs per AGENTS, validate actual sibling JAR path and all changed docs, commit focused followup only, DO NOT PUSH or write campaign-progress. Root handles Trading212 owner-procedure path and re-delivery. Finish cross-portfolio-final-review.json with findings classified as corrected (include final local SHA after correction) plus intentional historical URLs. No need permission pause; current task explicitly authorizes supporting documentation/path corrections.
```

No canonical repository prompt file was used. The existing
[run report](codex-runs/20261113-portfolio-documentation.md#cross-portfolio-plantuml-path-follow-up)
records the maintained README path correction, canonical companion attribution,
verified JAR path/notices, four successful local PlantUML syntax checks, Markdown
validation and unchanged raw assignment/source materials. No provider calls,
push, rendering or Visual Paradigm round trip was performed.

## 2026-11-13 – Publication remediation candidate

Direct one-off campaign invocation: “GitHub Portfolio — Final Publication
Remediation”, supplied as `task-specification.txt`; no canonical repository prompt
file was used. The exact invocation is retained in
[run 066](codex-runs/066-publication-remediation.md#2-invocation-prompt).

The campaign root prepared a local history candidate excluding the precise
third-party material set and added rights/provenance documentation. Original
application code, scripts, Compose, student notes/designs and permitted
publications remain unchanged. Run 066 records independent all-history object
and byte-preservation checks, private-reference handling, credential assessment,
and remaining owner/server-clearance requirements. Status:
`local_candidate_prepared_publication_blocked`; no remote rewrite, provider
change, rotation or visibility change is asserted.
