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
| 053 | 2026-06-24 | Direct implementation prompt from attached text plus user clarification | N/A | Final audit fixes F-001 through F-018, runtime validation, and password shortcut preservation | `completed_with_warnings` | `docs/ai/codex-runs/053-final-audit-fixes-f001-f018.md` |

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
