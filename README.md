# Rocket Sim

Live demo: https://mvs5465.github.io/rocket-sim/

Static browser starter for a side-on rocket builder in plain HTML/CSS/JS.

## Current scope

- Calm launch site scene (sky, clouds, sun, grass)
- Launch pad in side view
- Top-left rocket parts palette (engine, fuel tank, nosecone, booster)
- Top-left rocket parts palette (engine, fuel tank, stage separator, nosecone, booster)
- Click-to-select placement mode with snap targets
- Build-mode part tooltip includes stage assignment controls
- Side booster attach nodes on fuel tanks
- Drag core rocket parts up/down to reorder (rule-checked)
- Part tooltip with info + guarded delete
- Launch/recover flow with build mode and flight mode
- Pilot controls in flight: hold `Space` to fire, steer with `A`/`D`, press `E` to stage

## Run locally

Open `index.html` directly in a browser, or use a static server:

```sh
cd /Users/matthewschwartz/projects/rocket-sim
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Test Locally

```sh
cd /Users/matthewschwartz/projects/rocket-sim
npm install
npm test
npm run test:coverage
```

Coverage artifacts are written to `coverage/`.
