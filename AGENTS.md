# AGENTS.md

## Project Identity
- Project name: `rocket-sim`
- Public repo: `https://github.com/mvs5465/rocket-sim`
- Live site (GitHub Pages): `https://mvs5465.github.io/rocket-sim/`

## Product Direction
- Browser-based 2D rocket builder + flight sim.
- Build mode: place and manage parts on a launch pad with placement rules.
- Flight mode: pilot assembled vessel with `Space` thrust and `A/D` steering.
- Performance-first visuals: simple atmospheric scene, layered clouds, space transition, lightweight engine effects.

## Current Runtime Entry Points
- Main playable page: `index.html` in repo root.
- Script tags in `index.html` load legacy modular JS under `src/js/` (this is the active game path).
- Core gameplay modules currently in use:
  - `src/js/constants.js`
  - `src/js/renderer.js`
  - `src/js/launch-pad.js`
  - `src/js/rocket-stack.js`
  - `src/js/build-scene.js`
  - `src/js/parts-palette.js`
  - `src/js/flight-model.js`
  - `src/js/camera-model.js`
  - `src/js/game.js`
  - `src/js/main.js`

## Non-Active / Transitional Files
- `src/core/`, `src/scenes/`, `src/ui/`, `src/world/`, `src/style.css`, and `src/main.js` are scaffold/alternate architecture files and are not currently loaded by `index.html`.
- Keep them untouched unless explicitly migrating the runtime architecture.

## Local Development
- Requirements: Node.js (for tests), browser for runtime.
- Run app quickly:
  - `cd /Users/matthewschwartz/projects/rocket-sim`
  - `python3 -m http.server 8080`
  - open `http://localhost:8080`
- Optional: open `index.html` directly.

## Tests
- Test runner: Node built-in test runner with `c8` coverage.
- Commands:
  - `npm test`
  - `npm run test:coverage`
- Existing tests live under `tests/*.test.cjs` and validate core game logic modules.

## Deployment
- GitHub Pages is configured in simple mode:
  - source branch: `main`
  - source path: `/` (repo root)
- No GitHub Actions workflow is required for deployment at this time.

## Release Process
- First release already exists: `v0.1.0`.
- To cut next release:
  - ensure `main` is up to date and clean
  - create release/tag with `gh release create vX.Y.Z --target main --title "X.Y.Z" --generate-notes`

## Git Workflow Preferences
- Default preference is feature branch + PR.
- If user explicitly asks to push to `main`, do it directly.
- Conventional commit format is required (e.g. `feat(scope): description`).

## Implementation Notes / Guardrails
- Keep code ASCII unless a file already requires Unicode.
- Prefer small, test-backed changes in `src/js/*`.
- When changing physics/control/camera behavior, add or update regression tests.
- Preserve existing UX decisions:
  - click-to-select placement
  - `Escape` cancels placement
  - contextual part tooltip with guarded delete
  - only valid snap-node visibility during placement
  - spacebar can switch from build to flight and also throttle in flight
  - camera follows horizontally; vertical follow starts after rocket reaches viewport midpoint
