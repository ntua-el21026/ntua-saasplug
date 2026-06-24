# Run 057 - Map Fullscreen, Pricing Switches, and Status Views

## Invocation Prompt

Direct user prompt:

> You have the 2 following tasks:
> 1. Polish the map page of EV users UI: add a full screen option for map, that
> when pressed it will open in full screen the map and the list of points on
> left. We should be able to resume back to normal view.
> 2. In the rules for prices, add a on/off button, so that we can add many
> rules and select among them. Functionality will be: only one allowed to be on
> for each provider (if we turn on another one the old one turns of at the same
> time), if we have global, tit can be on but the provider that we have a
> specific rule for them should override global, only one global at a time (if
> we turn on another one the old one turns of at the same time) and if we turn
> on specific for all 3 of them the global should turn off and if we turn global
> on, then the provider specific ones should turn off. Live transitions in the
> UI.
> 3. From before (check screenshots folder again): the 8080 is too bad, we
> cannot see text and the main image is huge... We must have a hero text and
> slogan on the left (as a card) and the image on the right.
> 4. Explain better status checks and the values it can get (in chat only).
> Explain it well and what values it can get and how.

Follow-up prompt:

> Also, change this status view diagram, I don't like it. Make it be this one:
> from point views, how many they were in each status (like reserved,
> available, etc.). Also replace any similar card with another one, proper.

## Goal

Improve the EV map presentation, make pricing rule activation demo-friendly and
persistent, revise the public landing hero for readability on the gateway page,
and align provider analytics status visualization with point-view status counts.

## Implementation Summary

- Added an application-level fullscreen mode to the EV map page. It keeps the
  results list on the left, map on the right, preserves the existing map state,
  and exits via the same control or Escape.
- Added live on/off switches to operator pricing rules. The frontend applies
  immediate activation transitions while the backend now enforces the same
  persistence policy for global and provider-specific rules.
- Reworked the landing page into a left hero text/slogan card and right bounded
  map image, keeping account creation only in the header.
- Changed analytics status distribution semantics to count `usage.point_viewed`
  events by the point status included at view time. Status checks and
  reservations no longer move that chart.
- Updated chart copy, aria labels, empty state, route README, billing README,
  analytics README, and SPEC text to match the implemented semantics.

## Files Changed

- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/features/catalog/CatalogMap.tsx`
- `apps/frontend/src/features/landing/LandingPage.tsx`
- `apps/frontend/src/features/admin/AdminPages.tsx`
- `apps/frontend/src/features/admin/AdminUi.tsx`
- `apps/frontend/src/styles/app.css`
- `apps/frontend/src/test/admin-routing.test.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `apps/frontend/src/test/setup.ts`
- `apps/frontend/README.md`
- `services/billing-service/app/pricing.py`
- `services/billing-service/tests/test_billing_service_api.py`
- `services/billing-service/README.md`
- `services/analytics-service/app/aggregates.py`
- `services/analytics-service/tests/test_analytics_service_api.py`
- `services/analytics-service/README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`

## Validation

- `npm test -- src/test/admin-routing.test.tsx src/test/catalog-map-ui.test.tsx src/test/app-smoke.test.tsx` in `apps/frontend`: 45 tests passed.
- `npm run build` in `apps/frontend`: passed.
- `npm test -- --run` in `apps/frontend`: 50 tests passed.
- `PYTHONPATH=/home/peppasmich/NTUA-saasPlug/services/analytics-service:/home/peppasmich/NTUA-saasPlug/packages/events python -m pytest -s services/analytics-service/tests/test_analytics_service_api.py -q`: 27 tests passed.
- `PYTHONPATH=/home/peppasmich/NTUA-saasPlug/services/billing-service:/home/peppasmich/NTUA-saasPlug/packages/events python -m pytest -s services/billing-service/tests/test_billing_service_api.py -q`: 29 tests passed.
- `git diff --check`: passed.
- `curl -I --max-time 3 http://127.0.0.1:8080/`: gateway responded `200 OK`.

## Limitations and Manual Review

- Browser visual QA was not run through Playwright because the Product Design
  workflow requires using the user's chosen browser and no browser automation
  approval was requested in this run.
- The first parallel pytest attempt failed before collecting tests due a local
  pytest capture `FileNotFoundError` under Python 3.14. The service tests were
  rerun sequentially with `-s` and passed.
- The working tree already contained unrelated Postman and `.gitignore` changes
  before this run; they were not modified by this work.

## SPEC Conformance

The changes preserve gateway-relative frontend calls, viewport-based catalog
loading, billing ownership of pricing rules, analytics ownership of usage
aggregates, and the accepted provider status vocabulary:

```text
available
charging
reserved
malfunction
offline
unknown
```
