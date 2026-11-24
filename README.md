# Rift Duel

A small React and React Three Fiber duel prototype built around the champion GLBs in `champion_models/`.

## Live site

[Play Rift Duel](https://alfinjaison.github.io/rift-duel/)

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The GLB files are loaded directly from `champion_models/`; no extra asset copy is needed.

## Controls

- `W`, `A`, `S`, `D` to move
- Arrow keys also move; use `ArrowUp` to move forward without activating Yone or Mordekaiser's `W`
- `Space` for a basic attack
- `Q`, `W`, `E`, `R` for the four abilities
- Use the champion buttons in the top right to choose who you control; the other champion is the bot
- `Fight Again` starts a fresh round

## Deploy to GitHub Pages

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow deploys the site automatically after pushes to `main`.

The arena is built from lightweight Three.js geometry because this folder does not include a terrain model.
