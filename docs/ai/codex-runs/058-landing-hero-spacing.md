# Run 058 - Landing Hero Spacing

## Invocation Prompt

Direct user prompt:

> From the landing page remove this completely: "One map. Three providers. Live
> reservations.".
> Also, put the card with the text and the map a bit more down, because it
> collides with the header.
> Just do these changes fast.

## Goal

Make the public landing hero cleaner by removing the small kicker line and
adding vertical separation between the header and the split hero.

## Implementation Summary

- Removed the landing kicker text from the landing page markup.
- Removed the unused `.landing-kicker` styles.
- Added top margin to the landing hero so the text card and map image sit lower
  under the marketing header.

## Files Changed

- `apps/frontend/src/features/landing/LandingPage.tsx`
- `apps/frontend/src/styles/app.css`
- `docs/ai/prompt-log.md`

## Validation

- `rg -n "One map\\. Three providers\\. Live reservations\\.|landing-kicker" apps/frontend/src -S`: no matches.
- `npm test -- src/test/app-smoke.test.tsx` in `apps/frontend`: 10 tests passed.
- `npm run build` in `apps/frontend`: passed.

## Limitations and Manual Review

- No browser screenshot automation was run for this tiny adjustment.

## SPEC Conformance

The change is frontend-only and does not affect routing, gateway API access,
roles, provider integration, or service contracts.
