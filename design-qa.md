# Auth Landing Hero Design QA

## Comparison Target

- Source visual truth: `apps/frontend/src/assets/auth/ev-charging-map-hero.png`
  copied from the user-provided `Hero.png` reference.
- Implementation target: `http://localhost:8080/login`.
- Intended viewport and state: desktop login page, unauthenticated default state.

## Evidence

- The source asset was opened and reviewed at its native 1088 x 783 px size.
- The production frontend image was rebuilt and the `frontend` and
  `nginx-gateway` containers reported healthy. `GET /login` returned HTTP 200.
- Automated visual capture is blocked: the required in-app browser runtime
  rejected its Node REPL bootstrap before a tab could be opened. No screenshot
  of the rendered implementation is available for a side-by-side comparison.

## Fidelity Surfaces

- Fonts and typography: implemented with the existing saasPlug type scale.
  The new role heading matches the 14 px role-card title size; the commercial
  headline uses the established 22 px auth panel heading scale.
- Spacing and layout rhythm: the showcase is now placed after the hero copy,
  rather than at the bottom of the full-height column. It grows to a 900 px
  desktop maximum width with a 1.35:0.9 image/copy grid.
- Colors and visual tokens: existing repository color, border, radius, and
  elevation tokens are retained.
- Image quality and asset fidelity: the user-provided raster map image is
  copied into the frontend source tree and rendered with `object-fit: cover`;
  no CSS placeholder map remains in this auth showcase.
- Copy and content: the internal platform slogan was replaced by EV-user
  focused availability and reservation messaging. The presenter-password
  guidance text was removed.

## Findings

- [P1] Visual capture unavailable.
  Location: browser verification environment.
  Evidence: the in-app browser Node REPL rejected initialization before the
  login route could be captured.
  Impact: exact rendered image crop and desktop/mobile composition cannot be
  compared visually in this run.
  Fix: open `http://localhost:8080/login` in a browser and compare it with the
  copied source asset at the intended desktop viewport.

## Patches Made

- Replaced the CSS-drawn auth map with the copied Hero image asset.
- Moved the showcase to the upper part of the hero and enlarged it.
- Updated the slogan and supporting copy for EV users.
- Removed the password-guidance line and aligned the role heading size with
  role-card titles.

## Final Result

blocked

