# Prompt 15 - saasPlug Frontend Design-System Redesign

You are working in:

```text
ntua-el21026/NTUA-saasPlug
```

Task type:

```text
FRONTEND DESIGN-SYSTEM REDESIGN - IMPLEMENTATION + LIVE VISUAL QA - NO DEPLOYMENT
```

## Goal

Redesign the saasPlug frontend so it no longer looks childish, rough, oversized, or like a basic student prototype. The final result must look like a polished, professional SaaS product: precise, modern, trustworthy, reusable, responsive, accessible, and consistent across all user-facing screens.

This is not a one-off CSS beautification task. Implement a reusable frontend design architecture so future redesigns can be performed by changing design tokens, reusable assets, and shared components rather than editing each screen manually.

The intended visual direction is:

```text
Clean energy infrastructure cockpit
```

The UI should feel like a serious operational SaaS product for EV charging infrastructure, not a toy EV app and not a generic landing-page template.

## Hard constraints

1. Do not deploy anything.
2. Do not use Vercel deployment or add Vercel-specific deployment configuration.
3. Do not change backend business logic.
4. Do not change backend API contracts unless a frontend compile-time issue proves an existing frontend type is wrong.
5. Do not change microservice architecture.
6. Do not expose or print secrets from `.env` or any local environment file.
7. Do not create a new `.env` file.
8. Do not replace the whole frontend with an unrelated template.
9. Do not copy proprietary assets, screenshots, illustrations, brand marks, or CSS from external SaaS sites.
10. Do not hotlink external images from reference sites.
11. Do not hardcode one-off colors, shadows, spacing, radii, or typography values inside pages when they belong in reusable tokens/components.
12. Repository content, code comments, README updates, AI logs, issue titles, and documentation must remain in English.

## Required context to read first

Before editing anything, inspect the repository and read, at minimum, these files if present:

```text
AGENTS.md
README.md
.env.example
.gitignore
package.json
docker-compose.yml
deploy/nginx/default.conf
docs/specs/SPECIFICATIONS.md
docs/specs/README.md
docs/architecture-summary.md
docs/ai/README.md
docs/ai/prompts/README.md
docs/ai/codex-runs/README.md
apps/frontend/package.json
apps/frontend/src/**
```

If a file does not exist, continue and mention that in the run log. Do not fail the task only because optional documentation is absent.

## External design references to inspect

Use browser-based inspection if available. Visit the following official sites and study their current visual/product design patterns. Do not copy assets or code. Extract reusable design lessons only.

### Primary SaaS references

1. Linear - https://linear.app
2. Stripe - https://stripe.com
3. Vercel - https://vercel.com
4. Notion - https://www.notion.com
5. Supabase - https://supabase.com
6. Clerk - https://clerk.com
7. Intercom - https://www.intercom.com
8. Ramp - https://ramp.com
9. Mercury - https://mercury.com
10. Fleetio - https://www.fleetio.com

### Optional domain/interaction references

Use these only for interaction patterns, not for assets:

1. PlugShare - https://www.plugshare.com
2. ChargePoint - https://www.chargepoint.com
3. Google Maps - https://www.google.com/maps

If internet access is unavailable, continue from the design principles below and record the limitation in the AI run log. Do not block implementation because external browsing fails.

## Design lessons to apply from the references

Apply the shared language of high-quality SaaS products:

1. Product-first UI presentation.
   - Show realistic product surfaces, not decorative filler.
   - Make map, filters, drawers, cards, tables, invoices, and dashboards look real.

2. Neutral base with controlled accents.
   - Use neutral surfaces and one main electric-blue accent.
   - Use green/amber/red only as semantic status colors.

3. Precise typography.
   - Use clean, modern typography such as Inter, Geist, or the best already-available equivalent.
   - Avoid overly thick fonts.
   - Avoid oversized headings/buttons.

4. Dense but readable SaaS layout.
   - Use strong hierarchy, compact spacing, consistent cards, and clear status chips.
   - The UI should be professional, not sparse in a toy-like way.

5. Reusable component system.
   - Build primitives and domain components.
   - Pages should compose components; pages should not own global design decisions.

6. Progressive disclosure.
   - Keep primary actions visible.
   - Hide secondary filters/details behind drawers, popovers, or “More filters”.

7. Polished interaction states.
   - Every interactive element must have default, hover, focus-visible, active, selected, disabled, loading, error, and empty states where applicable.

8. Subtle motion only.
   - Use small transitions, drawer slide-ins, skeleton loading, and soft hover changes.
   - Avoid excessive animation, parallax, neon effects, or heavy glassmorphism.

## Target information architecture

Adapt this structure to the current repository routing system. Do not break existing routes. If some routes do not exist, create or improve the closest available equivalents.

```text
/
  Landing / role entry page

/auth
  Login
  Provider registration

/app
  EV user app shell
  /map
  /reservations
  /account

/provider
  Provider dashboard shell
  /overview
  /charging-points
  /analytics
  /invoices
  /exports
  /settings

/operator
  Operator dashboard shell
  /overview
  /providers
  /catalog-health
  /sync
  /analytics
  /pricing
  /invoices
```

If the current app uses a different route layout, preserve compatibility and implement the same role-based UX within the existing router.

## Required reusable frontend architecture

Create or refactor toward the following architecture under `apps/frontend/src`, adapting names only when the existing project structure requires it.

```text
apps/frontend/src/
  assets/
    brand/
    icons/
    illustrations/
    map/
  components/
    ui/
    layout/
    navigation/
    feedback/
    data-display/
    forms/
    map/
    charts/
    domain/
      ev/
      provider/
      operator/
      billing/
      status/
  design/
    tokens.ts
    theme.css
    typography.css
    motion.css
    shadows.css
  features/
    auth/
    ev/
    provider/
    operator/
    billing/
    analytics/
    catalog/
  lib/
    utils/
    formatting/
    mock-data/
  pages/ or routes/ or app/
```

If Tailwind is already used, map tokens into Tailwind config and CSS variables. If Tailwind is not used, implement tokenized CSS variables and reusable class utilities without forcing an unnecessary framework migration.

## Design tokens

Implement a central token layer. Use exact or near-equivalent values unless the existing setup makes a small adjustment necessary.

### Color tokens

```text
background:        #F7F9FC
surface:           #FFFFFF
surface-muted:     #F1F5F9
surface-elevated:  #FFFFFF
text-primary:      #0F172A
text-secondary:    #64748B
text-muted:        #94A3B8
border:            #E2E8F0
border-strong:     #CBD5E1
primary:           #2563EB
primary-hover:     #1D4ED8
primary-soft:      #DBEAFE
energy:            #10B981
energy-soft:       #D1FAE5
warning:           #F59E0B
warning-soft:      #FEF3C7
danger:            #EF4444
danger-soft:       #FEE2E2
info:              #0EA5E9
info-soft:         #E0F2FE
```

### Radius tokens

```text
radius-xs: 6px
radius-sm: 8px
radius-md: 12px
radius-lg: 16px
radius-xl: 20px
radius-2xl: 24px
```

Use moderate radius. Do not make the whole app overly rounded.

### Shadow tokens

```text
shadow-card:      0 1px 2px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.08)
shadow-floating:  0 12px 32px rgba(15, 23, 42, 0.14)
shadow-modal:     0 24px 64px rgba(15, 23, 42, 0.20)
```

### Spacing scale

Use a consistent 4px-based spacing system:

```text
1: 4px
2: 8px
3: 12px
4: 16px
5: 20px
6: 24px
8: 32px
10: 40px
12: 48px
16: 64px
```

### Typography scale

```text
caption:     12px / 16px / 500
label:       13px / 18px / 500
body-sm:     14px / 20px / 400
body:        15px / 24px / 400
body-strong: 15px / 24px / 600
title-sm:    18px / 26px / 600
title:       22px / 30px / 650
heading:     30px / 38px / 650
hero:        44px / 52px / 700
```

Use font weights carefully. Avoid heavy, bulky typography.

## Required primitive components

Implement or improve these reusable primitives. Prefer a shadcn-style architecture if the project already uses Tailwind/shadcn or can support it cleanly.

```text
Button
IconButton
Input
SearchInput
Select
Checkbox
Switch
Slider
Textarea
Tabs
Card
MetricCard
Badge
StatusBadge
FilterChip
Tag
Tooltip
Popover
DropdownMenu
Drawer
Modal
Toast
Skeleton
EmptyState
ErrorState
DataTable
Pagination
DateRangePicker
ChartCard
SectionHeader
PageHeader
```

Each primitive must be reusable and documented by clear props/types. Avoid duplicated variants inside page files.

## Required layout components

Implement or improve:

```text
AppShell
TopBar
Sidebar
RoleSwitcher or RoleEntry
PageContainer
SplitPane
DashboardGrid
AuthLayout
MarketingLayout
```

The application should support at least:

1. EV user surfaces.
2. Provider admin surfaces.
3. Operator/admin surfaces.

## Required domain components

Implement reusable domain components where relevant:

```text
ChargingPointCard
ChargingPointDrawer
ChargingPointMarker
ChargingPointStatusBadge
ProviderBadge
ProviderHealthBadge
ReservationCard
ReservationModal
InvoiceStatusBadge
InvoiceSummaryCard
UsageMetricCard
CatalogFreshnessIndicator
SyncRunStatusBadge
PricingRuleCard
MapFilterPanel
MapFloatingControls
SelectedFiltersBar
AvailabilityLegend
```

These components should encapsulate domain presentation logic. Pages should not manually recreate provider badges, invoice badges, availability colors, or marker styles.

## Visual requirements per major screen

### 1. Landing / role entry

Build a professional SaaS entry page with:

1. Clean hero section.
2. Product mockup area showing a realistic map + dashboard surface.
3. Role entry cards for EV user, provider admin, and operator.
4. A concise benefits strip.
5. A serious tone: no cartoon visuals, no childish oversized icons.

Suggested copy:

```text
One network for every EV charging provider.
Find, compare, reserve, and manage charging points across connected providers.
```

### 2. Authentication

The login/register screens must be polished and consistent:

1. Centered auth card.
2. Clear Google login button for EV users if present.
3. Standard email/password path if already supported.
4. Provider registration entry with integration/API details if present.
5. Clean error/loading states.

### 3. EV map/search

This is the highest-priority screen.

Desktop layout:

```text
Top bar
Left filter/results panel
Main map canvas
Floating map controls
Right-side charging point drawer when selected
```

Mobile layout:

```text
Full-screen map
Top search field
Bottom sheet for filters/results/details
Compact floating controls
```

Implement:

1. Polished search input.
2. Compact filter chips.
3. “More filters” drawer/panel.
4. Selected filters bar with removable chips.
5. Results count.
6. Availability legend.
7. Semantic markers:
   - available: energy/green
   - busy/unknown/stale: warning/amber
   - unavailable: danger/red
   - selected: primary/blue outline
8. Charging point detail drawer.
9. Loading skeletons.
10. Empty state when no chargers match filters.
11. Error state if map/status data cannot be loaded.

Do not make the map controls large, rough, or default-looking. They must feel integrated into the SaaS UI.

### 4. Charging point detail + reservation

Drawer must show:

1. Provider badge.
2. Charging point/station name.
3. Status chip.
4. Last updated/cache age.
5. Price.
6. Power.
7. Connector types.
8. Address/distance if available.
9. Primary reserve CTA.
10. Secondary provider/details action if available.

Reservation modal must have polished states:

1. Checking availability.
2. Reservation confirmed.
3. Provider rejected request.
4. Provider timeout / retry.

### 5. Provider dashboard

Implement a professional provider SaaS dashboard:

Top metrics:

```text
Searches involving my points
Point views
Status checks
Successful reservations
Conversion rate
Current unpaid invoice amount
Data freshness
```

Content:

1. KPI cards.
2. Charts in reusable `ChartCard` wrappers.
3. Top charging points table.
4. Status distribution.
5. Billing/invoice summary.
6. Usage export CTA.
7. Provider API health / catalog freshness indicator.

### 6. Provider invoices / exports

Build polished operational finance screens:

1. Invoice list table.
2. Status chips: draft, issued, paid, overdue.
3. Invoice detail card or drawer.
4. Mock payment CTA if payment is implemented as mock/demo.
5. Export usage log action.
6. Clear empty and loading states.

### 7. Operator dashboard

Build an operator console with:

Top metrics:

```text
Total providers
Active charging points
Reservations today
Failed provider calls
Catalog freshness
Issued invoices
Estimated platform revenue
```

Content:

1. Provider health table.
2. Sync run status table.
3. Catalog freshness section.
4. Failed/stale status indicators.
5. Global analytics chart cards.
6. Pricing-rule summary cards if existing functionality supports it.

The operator UI should be denser and more operational than the EV user UI.

## Data handling requirements

1. Use existing API clients/data-fetching logic where available.
2. If backend endpoints are not available during local QA, use existing placeholder/mock data patterns or create isolated frontend mock data under `lib/mock-data`.
3. Mock data must be clearly separated from production API logic.
4. Do not fake successful backend writes in production paths unless the current app already uses mock/demo behavior.
5. Preserve existing user flows and route behavior.

## Asset requirements

Create reusable local assets only where needed:

```text
assets/brand/saasplug-mark.svg
assets/icons/plug.svg
assets/icons/charger.svg
assets/icons/invoice.svg
assets/icons/provider.svg
assets/icons/operator.svg
assets/map/marker-available.svg
assets/map/marker-busy.svg
assets/map/marker-unavailable.svg
assets/map/marker-selected.svg
```

You may alternatively implement icons as reusable React SVG components if that is more idiomatic for the codebase.

Rules:

1. Assets must be local and reusable.
2. No external hotlinks.
3. No copied third-party brand assets.
4. Do not scatter SVG blobs across page files.
5. Keep provider-specific colors in a provider/theme mapping, not hardcoded throughout the UI.

## Accessibility requirements

Implement at least:

1. Visible `focus-visible` state for keyboard users.
2. Semantic buttons/links.
3. Accessible form labels.
4. Dialog/drawer escape behavior if supported by the component stack.
5. Sufficient contrast for text and status badges.
6. Reduced-motion support for animations.
7. Tables with readable headers.
8. Map interactions must have accessible non-map alternatives where feasible, such as a results list.

## Responsiveness requirements

Test and polish at least these viewport sizes:

```text
390x844   mobile
768x1024  tablet
1280x800  laptop
1440x900  desktop
```

The EV map page is especially important on mobile. It should use bottom sheets or equivalent compact surfaces rather than squeezing a desktop sidebar into a small screen.

## Implementation guidance

1. Prefer a component-first implementation.
2. Start with tokens/theme primitives.
3. Then implement UI primitives.
4. Then implement layout components.
5. Then refactor pages to consume shared components.
6. Then polish interactions and states.
7. Then run live visual QA.

Do not make broad unrelated refactors. Keep the work focused on frontend structure and polish.

## Suggested implementation order

1. Inspect repo, frontend stack, current routes, current components, and styling approach.
2. Inspect external references if network/browser access is available.
3. Run the current frontend locally and capture baseline observations.
4. Create/update token layer and global theme.
5. Create/update reusable UI primitive components.
6. Create/update reusable layout components.
7. Create/update reusable saasPlug domain components.
8. Redesign landing/auth surfaces.
9. Redesign EV map/search/detail/reservation surfaces.
10. Redesign provider dashboard/invoices/exports surfaces.
11. Redesign operator dashboard/global analytics/catalog-health surfaces.
12. Add loading/empty/error states.
13. Run lint/build/tests.
14. Run browser-based live QA across target viewports.
15. Fix visual regressions.
16. Write AI run log.

## Local live inspection requirement

After implementation, run the frontend locally using the repository's documented command. If the app is intended to run through Docker Compose or the Nginx gateway, inspect the relevant files and use the correct local URL.

Do not assume the port. Derive it from project configuration.

If the app is already running, use the running instance. If not, start it only through existing documented local development commands. Do not deploy.

Use browser-based QA if available:

1. Open the landing/entry page.
2. Open EV map/search page.
3. Open EV reservation flow if possible.
4. Open provider dashboard.
5. Open provider invoices/exports.
6. Open operator dashboard.
7. Check mobile and desktop viewports.
8. Check hover/focus/selected/loading/empty/error states where feasible.

Record before/after notes and any limitations in the run log.

## Validation commands

Run the applicable commands based on the actual frontend package scripts. Prefer package-local commands from `apps/frontend`.

At minimum, attempt:

```bash
npm install
npm run lint
npm run build
npm run test
```

If the project uses pnpm/yarn or has different scripts, use the existing package manager and scripts instead. Do not introduce a package manager switch.

If a command fails due to pre-existing issues or missing environment, document it precisely and distinguish it from issues introduced by this task.

## Documentation / AI run log

Create or update:

```text
docs/ai/prompts/prompt_15_frontend_design_system_redesign.md
docs/ai/codex-runs/015-frontend-design-system-redesign.md
```

The run log must include:

1. Prompt/task summary.
2. External references inspected and whether browsing succeeded.
3. Current frontend baseline observations.
4. Design-system architecture created/updated.
5. Major files changed.
6. Components created/updated.
7. Screens redesigned.
8. Commands run and results.
9. Browser/live QA results.
10. Known limitations.
11. Follow-up recommendations, only if necessary.

## Acceptance criteria

The task is complete only if all of the following are true:

1. The frontend has a central reusable token/theme layer.
2. Shared UI primitives exist and are used by pages.
3. Shared layout components exist and are used by role-specific pages.
4. Domain components exist for EV charging, providers, reservations, invoices, statuses, and analytics where applicable.
5. The app no longer relies on page-level one-off styling for common UI elements.
6. Colors, typography, spacing, radii, and shadows are coherent and professional.
7. Filters, map controls, menus, cards, tables, drawers, modals, and CTAs are polished.
8. EV map/search UX is redesigned for desktop and mobile.
9. Provider dashboard/invoice/export UX is redesigned or substantially polished.
10. Operator dashboard/global analytics UX is redesigned or substantially polished.
11. Loading, empty, error, hover, focus, active, disabled, and selected states are implemented where relevant.
12. The app builds successfully, or any failure is clearly documented as pre-existing/environment-related.
13. Live/browser QA is performed where possible.
14. No backend business logic or deployment configuration is changed.
15. No secrets are exposed.
16. Documentation/run log is updated in English.

## Final response format

When finished, respond with:

```text
COMPLETED
```

or

```text
COMPLETED_WITH_WARNINGS
```

Then include:

1. One-paragraph summary.
2. Files created.
3. Files modified.
4. External references inspected.
5. Local live URLs tested.
6. Validation commands and results.
7. Browser QA summary.
8. Known limitations.
9. Recommended next prompt, only if needed.

Do not include secrets or raw `.env` values.
