# Codex Run 060 - Map Quick View Point Events

## Invocation Prompt

Direct user prompt:

> We must update the logic of the app: a marker tap is equal to point view!
> This is fundamental and should always be show.
> We should not press reserve charger on the pop-up that opens when we press the marker to be thought as point view. It should also count towards billing, analytics, etc.
> Update the whole logic to this...

## Goal

Treat opening a map/list quick-detail popup as a canonical point view so the
same `usage.point_viewed` event stream feeds analytics and billing without
requiring the user to open the full point-detail route or press reserve.

## Implementation Summary

- Added `POST /points/{provider_code}/{external_point_id}/views` to
  `catalog-service`.
- The new endpoint reads the active catalog point, publishes
  `usage.point_viewed`, includes the current catalog status and `view_source`,
  and returns a non-raw catalog point response.
- Full point-detail reads continue publishing `usage.point_viewed` with
  `view_source=detail`.
- EV map marker/list quick-detail opens now call the new endpoint best-effort
  with `view_source=map_quick_view`.
- Updated frontend and backend tests to prove marker tap alone records a point
  view and reserved blue points publish `status=reserved`.
- Updated docs/specs to define map/list quick views as point views for
  analytics and billing.

## Files Changed

- `apps/frontend/src/features/catalog/CatalogPage.tsx`
- `apps/frontend/src/test/catalog-map-ui.test.tsx`
- `services/catalog-service/app/routes.py`
- `services/catalog-service/app/schemas.py`
- `services/catalog-service/tests/test_catalog_service_api.py`
- `apps/frontend/README.md`
- `services/catalog-service/README.md`
- `services/analytics-service/README.md`
- `services/billing-service/README.md`
- `docs/specs/SPECIFICATIONS.md`
- `docs/ai/prompt-log.md`
- `docs/ai/codex-runs/060-map-quick-view-point-events.md`

## Tests Run

- `PYTHONPATH=/home/peppasmich/NTUA-saasPlug/services/catalog-service:/home/peppasmich/NTUA-saasPlug/packages/events python -m pytest -s services/catalog-service/tests/test_catalog_service_api.py -q`
  - Result: passed, 34 tests.
- `npm test -- src/test/catalog-map-ui.test.tsx`
  - Result: passed, 5 tests.
- `PYTHONPATH=/home/peppasmich/NTUA-saasPlug/services/billing-service:/home/peppasmich/NTUA-saasPlug/packages/events python -m pytest -s services/billing-service/tests/test_billing_service_api.py -q -k "usage_point_viewed"`
  - Result: passed, 1 test selected.
- `PYTHONPATH=/home/peppasmich/NTUA-saasPlug/services/analytics-service:/home/peppasmich/NTUA-saasPlug/packages/events python -m pytest -s services/analytics-service/tests/test_analytics_service_api.py -q -k "point_view_status"`
  - Result: passed, 2 tests selected.
- `npm run build`
  - Result: passed.

## Specification Conformance

The change preserves the accepted architecture: frontend still calls only
gateway-relative `/api/...` paths, catalog-service remains the point-view event
producer, and RabbitMQ is used only for asynchronous analytics/billing
propagation after the user-facing catalog request completes.

## Limitations

Point-view tracking remains best-effort, matching existing catalog event
publishing semantics. If RabbitMQ is unavailable after the catalog endpoint
completes, the UI still opens the quick-detail popup and the event may not be
available for downstream analytics/billing until event publishing is healthy.
