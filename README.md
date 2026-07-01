# The Sovereign Game

A drift-proof engine for a text game where **you are the Prime Minister of the United Kingdom** and the
LLM narrates the world around you. It's a phone-first PWA that fixes the classic problem of long
prompt-based games — **state drift and hallucination** — by moving all the game's memory out of the
model and into code.

## The idea

In a normal prompt-based playthrough the LLM is asked to be *both the narrator and the database*: it
has to remember every number, open tasking, cabinet member and secret across hundreds of turns. It
can't — its context fills up and it quietly contradicts or forgets things.

This app splits the two jobs:

- **The app owns all state** — the numbers, cabinet, open loops, streams, foreign relations, the
  calendar, the dice — in typed, validated code (never in the model's memory).
- **Your Claude/ChatGPT subscription is used only to _narrate_**, via a copy-paste relay.

Each turn the app builds a short, authoritative prompt (rules + a snapshot of the current state +
the dice it has _already rolled_). You paste it into your chat; the model replies with the scene
**and** a small machine-readable `<<<DELTA … DELTA>>>` block; you paste that back; the app validates
it and applies it deterministically.

Because the app re-supplies the full state every turn, **the chat never has to remember anything —
you can start a brand-new chat whenever you like and lose nothing.** Turn 300 is as stable as turn 1.

### What makes it drift-proof
- **Dice in code** — the d100 resolutions, d8 random events and d6 world-variance are rolled by a
  seeded, reproducible RNG. The model only *narrates* the result; it can't fudge.
- **Numbers clamped by code** — the model proposes *deltas* (`-3`), never absolutes; the app clamps.
- **Open loops can't vanish** — taskings are tracked records; due ones are force-injected into the
  prompt until resolved.
- **Schema validation at the boundary** — a malformed reply is caught and a one-tap *repair prompt*
  recovers it; your state is never half-applied.

## How to play

1. **New game** → run through Setup (cabinet + 9 doctrine dials).
2. On the **Play** tab, tap an option (or type your own instruction).
3. Tap **Copy turn prompt**, open your chat, paste, send.
4. Copy the model's whole reply, come back, paste it in, tap **Apply**.
5. The scene, the numbers and the dossier update. Repeat.

Tip: you never need to keep the same chat open. Start a fresh one any time — the app is the memory.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173/pmgame/
npm test          # engine + reducer + golden-replay tests
npm run build     # typecheck + production build to dist/
```

## Deploy (host once, forget)

This ships as a static site to **GitHub Pages** via `.github/workflows/deploy.yml`.

One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment → Source:
GitHub Actions**. Then every push to `main` builds and deploys automatically to
`https://<user>.github.io/pmgame/`.

If you fork or rename the repo, update `base` in `vite.config.ts` (and the `start_url`/`scope` in the
manifest) to match the new path.

## Project layout

```
src/
  state/     schema.ts · delta.ts (fence parser) · reducer.ts (invariants) · migrations.ts
  engine/    rng.ts · resolve.ts · events.ts · turn.ts   — the deterministic dice
  prompt/    systemRules.ts · builder.ts · repair.ts · fewshot.ts
  setup/     content.ts · init.ts                          — character creation
  persistence/store.ts                                     — IndexedDB + export/import
  game/      controller.ts                                 — engine ⇄ UI glue
  app/       Preact UI (Home, Setup, Play, Dossier, StatePanel, Settings)
```

## Later, if you want zero copy-paste

Add an Anthropic API key and have the app call the model directly — the copy-paste relay disappears
and turns become one tap. The whole state engine stays exactly as-is; only the transport changes.
