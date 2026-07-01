# PRD: World-Class Gameplay — The Sovereign Game

## Introduction / Overview

**The Sovereign Game** already has a rare foundation: a drift-proof engine where the app owns
all state (numbers, cabinet, open loops, foreign reads, seeded dice) and the LLM only *narrates*,
via either the copy-paste relay or the one-tap connection. The core loop is solid but **uniform** —
every week is the same shape: read a scene → pick option A/B/C (or type an instruction) → apply a
delta. It's a strong skeleton without the theatre, texture, or arc that make a political-drama sim
*world-class*.

This PRD is a **flagship overhaul**, delivered as five incremental phases. It keeps the game exactly
as simple to run and cheap to play as it is today (no backend, no required API key, no new setup,
phone-first), while adding:

1. **Set-piece turn types** *(the centrepiece)* — the loop stops being one shape. Some weeks are
   **PMQs** duels, some are a **Budget** you actually allocate, some a **COBRA** crisis collapsed to
   hours, some a **foreign summit** with a real leader across the table, some a **reshuffle**. This is
   where "being PM" becomes visceral, and it is **deliberately balanced between domestic and
   international** so the game never becomes a local-council grind.
2. **Progress you can feel** — stat trends, sparklines, a domestic↔international dashboard, and a
   "why did this number move" trace, so cause and effect become legible.
3. **Narrative & scene richness** — the model already emits `*[Reuters wire]*`, `*[FCDO flash, B2]*`,
   `*[PPS note]*` tags; we render them as real wires, letterhead memos and tabloid front pages, and
   give the cast cheap deterministic portraits — turning plain text into an authored scene.

**Guiding constraint (non-negotiable):** every feature must work as a static PWA with no backend, no
required API key, an offline/deterministic engine, and on-device saves — and must work on **both**
transports (copy-paste relay *and* direct API). If a feature can't be done cheaply and simply on a
phone, it is out of scope.

## Goals

- **Make the turn loop varied and iconic.** Introduce a first-class *turn-kind* system with at least
  five distinct set-pieces, roughly half domestic and half international, scheduled deterministically
  by the engine so the game stays drift-proof.
- **Preserve the domestic↔international balance.** No phase should tilt the game into local politics;
  the scheduler and the dashboard both actively enforce a mix of home and abroad.
- **Make progress legible.** A player should be able to glance at the HUD and know whether they are
  winning, and see *why* each key number moved last turn.
- **Make every scene feel authored.** Documents, headlines and cast get real visual treatment instead
  of undifferentiated body text.
- **Change nothing about how simple, cheap and private the game is to run.** Zero backend, zero
  required spend, zero extra setup, works offline, saves on-device.
- **Keep both transports first-class.** Copy-paste and API paths must reach identical game outcomes.

## Design Principles / Guardrails (apply to every story)

- **Engine owns the schedule.** Which set-piece fires on a given week is decided in code
  (`prepareTurn` in [src/engine/turn.ts](src/engine/turn.ts)) from the calendar + state, *not* by the
  model. The model only receives a different prompt template. This keeps the game drift-proof.
- **Deltas only, code clamps.** Any new state a set-piece produces flows through the existing
  `TurnDelta` → reducer path ([src/state/delta.ts](src/state/delta.ts),
  [src/state/reducer.ts](src/state/reducer.ts)). No absolute numbers from the model.
- **Transport-agnostic prompts.** New prompt modules must slot into
  [src/prompt/builder.ts](src/prompt/builder.ts) and honour both `OUTPUT_CONTRACT_CHAT` and
  `OUTPUT_CONTRACT_API` in [src/prompt/systemRules.ts](src/prompt/systemRules.ts).
- **Additive, migrated schema.** Every new field is optional with a default and covered by a bump in
  [src/state/migrations.ts](src/state/migrations.ts) so old saves keep loading.
- **Cheap visuals only.** Portraits/headlines are CSS + deterministic SVG (monograms, silhouettes,
  faction colour) — **no image generation, no asset pipeline, no external fonts/CDNs.**
- **Pure-logic tests.** New engine logic gets vitest coverage under the existing
  [vitest.config.ts](vitest.config.ts) golden-replay style.

---

## Phased Roadmap

| Phase | Theme | Why here |
|------|-------|----------|
| **1** | **Set-piece engine + first two set-pieces (PMQs · Foreign summit)** | Delivers the hero feature and the domestic/international balance immediately. |
| **2** | **More set-pieces (Budget · COBRA · Reshuffle)** | Fills out the variety; adds genuinely different interactions. |
| **3** | **Progress & data-viz** | Makes the new stakes legible; low-risk, improves every turn. |
| **4** | **Narrative & scene richness** | Turns authored scenes visual; pure presentation. |
| **5** | **Balanced world arc + legacy** | Gives the premiership an arc and a finish, proportionate to home & abroad. |

---

## User Stories

### Phase 1 — The Set-Piece Turn Engine (Hero)

#### US-101: Add a first-class `turnKind` to state + a deterministic scheduler
**Description:** As the engine, I need to know what *kind* of turn each week is, decided in code, so
scenes can vary without the model owning the schedule.

**Acceptance Criteria:**
- [ ] Add `turnKind` enum to [src/state/schema.ts](src/state/schema.ts): `'standard' | 'pmqs' | 'budget' | 'cobra' | 'summit' | 'reshuffle' | 'election'` (default `'standard'`).
- [ ] Add an optional `queuedTurnKind` field (nullable) so a player-initiated set-piece can be requested for next week.
- [ ] Add a `scheduleTurnKind(state)` function in [src/engine/turn.ts](src/engine/turn.ts), called inside `prepareTurn`, that resolves the week's kind from: `queuedTurnKind` (highest priority) → threat-driven COBRA (`threat >= 4`) → calendar-driven set-pieces → else `standard`.
- [ ] The scheduler is deterministic (seeded RNG only; no `Date.now`/`Math.random`) so replays stay identical.
- [ ] Bump `SCHEMA_VERSION` and add a migration defaulting `turnKind='standard'`, `queuedTurnKind=null`.
- [ ] Unit tests: given fixed calendar/threat states, `scheduleTurnKind` returns the expected kind; golden-replay test still passes.
- [ ] Typecheck + `npm test` pass.

#### US-102: Prompt builder selects a set-piece prompt module by `turnKind`
**Description:** As the narrator, I need turn-specific instructions so a PMQs week reads and plays
differently from a standard week — on both transports.

**Acceptance Criteria:**
- [ ] Create `src/prompt/setpieces.ts` exporting one instruction block per non-standard `turnKind`, each layered **on top of** `RULES_CORE` and compatible with both output contracts.
- [ ] `buildTurnPrompt` in [src/prompt/builder.ts](src/prompt/builder.ts) injects the matching set-piece block (a new `━━━ THIS WEEK IS A SET PIECE ━━━` section) when `turnKind !== 'standard'`.
- [ ] Each block specifies the semantics of the three options for that kind (e.g. PMQs registers, summit postures) and which state rows the delta should touch.
- [ ] `standard` turns are byte-identical to today's prompt (no regression).
- [ ] Snapshot-style test asserting each `turnKind` yields its expected section in both `'chat'` and `'api'` modes.
- [ ] Typecheck + `npm test` pass.

#### US-103: PMQs set-piece (domestic)
**Description:** As the PM, I want a Prime Minister's Questions duel so the iconic weekly clash exists
in the game.

**Acceptance Criteria:**
- [ ] Scheduler fires `pmqs` on a readable domestic cadence (e.g. roughly every 4th standard-eligible week when the House is sitting), never back-to-back with another set-piece.
- [ ] PMQs prompt module instructs the model to stage a short exchange (Leader of the Opposition and/or the Reform leader landing 1–2 attacks) and to frame the three options as **registers** (e.g. *attack back* / *defuse with data* / *pivot to your record*), each risk-tagged.
- [ ] Resolution uses the existing d100 path; the delta touches `approval`, `capital` and/or `whip` and appends a `keyHistory` line.
- [ ] Play screen ([src/app/Play.tsx](src/app/Play.tsx)) shows a **"PMQs"** set-piece banner above the scene; options keep the existing A/B/C affordance (no new interaction required for this story).
- [ ] Works identically on copy-paste and API paths.
- [ ] Typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill (trigger a PMQs week, confirm banner + register-style options).

#### US-104: Foreign summit / bilateral set-piece (international)
**Description:** As the PM, I want summits and one-to-one meetings with real world leaders so foreign
policy is a set-piece, not a footnote — keeping the game balanced toward the world stage.

**Acceptance Criteria:**
- [ ] Scheduler fires `summit` on an international cadence and/or when a foreign capital's `read` crosses a threshold or a foreign-crisis event has fired — so home and abroad alternate.
- [ ] Summit prompt module invokes the existing realist-engine voice (Trump/Macron/Xi/Putin walk on in character) and frames options as **postures** (e.g. *concede to hold the alliance* / *hedge* / *call the bluff*), risk-tagged.
- [ ] Delta primarily moves `foreignCapitals[].readDelta` + `posture`, and may touch `threat`/`capital`; appends `keyHistory`.
- [ ] Play screen shows a **"Summit — <Capital>"** banner; the relevant capital is surfaced (name + leader from `CAPITAL_LEADERS`).
- [ ] Works on both transports.
- [ ] Typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

#### US-105: Set-piece awareness across the HUD and Dossier
**Description:** As the PM, I want to see at a glance what kind of week I'm in and what's coming.

**Acceptance Criteria:**
- [ ] The Play HUD header ([src/app/Play.tsx](src/app/Play.tsx)) shows the current `turnKind` as a labelled chip when not `standard` (styled per kind).
- [ ] The Dossier ([src/app/Dossier.tsx](src/app/Dossier.tsx)) shows a small **"This week"** line naming the set-piece.
- [ ] `standard` weeks show no chip (unchanged look).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-106: Player-initiated actions menu (agency between forced decisions)
**Description:** As the PM, I want to *choose* to call a reshuffle, convene COBRA, or make a statement,
instead of only reacting to what the week throws at me.

**Acceptance Criteria:**
- [ ] Add a compact **"PM actions"** affordance on the Play screen (e.g. a small button opening a sheet) listing player-initiable set-pieces available given current state.
- [ ] Selecting one sets `queuedTurnKind` so the **next** turn becomes that set-piece; the choice is visible/cancellable before the turn is built.
- [ ] Guardrails: only offer actions that make sense (e.g. reshuffle only if cabinet exists); at most one queued kind at a time.
- [ ] Queuing is captured in state and survives save/reload.
- [ ] Typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

---

### Phase 2 — More Set-Pieces

#### US-201: The Budget / Fiscal Event (domestic, new interaction)
**Description:** As the PM, I want to actually *allocate* at a fiscal event, not pick from three
sentences, so the Budget feels like the Budget.

**Acceptance Criteria:**
- [ ] Scheduler fires `budget` at a fixed calendar point (e.g. an autumn statement week) and/or via a queued PM action.
- [ ] A dedicated Budget UI presents **fiscal headroom** (derived in code from `gilt`/`economy` doctrine) and a small set of departments/levers the player distributes across (chips/steppers, phone-friendly, no free-text math).
- [ ] The player's allocation is serialised into the `chosenAction` string handed to the model (so the existing prompt/delta path is reused unchanged).
- [ ] The model narrates market + political reaction; delta moves `gilt`, `gbp`, `approval`, `capital` and relevant `streams`, consistent with the allocation.
- [ ] Over/under-committing headroom is reflected (e.g. bigger gilt move) — logic lives in code, surfaced to the model as an engine roll/injection.
- [ ] Works on both transports; typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

#### US-202: COBRA crisis mode (crisis pacing + styling)
**Description:** As the PM, I want genuine crises to *feel* like crises — hours not weeks, high stakes,
a room going quiet.

**Acceptance Criteria:**
- [ ] Scheduler fires `cobra` when `threat >= 4` or immediately after a security/foreign random event fires (per [src/engine/events.ts](src/engine/events.ts)).
- [ ] COBRA prompt module collapses pace to hours (per `RULES_CORE` crisis guidance), raises stakes, and tags options accordingly (often `hard`/`desperate`).
- [ ] The turn may not advance a full week (`calendar.advanceWeeks: 0`) when the crisis is intraday; the engine allows this.
- [ ] Play screen shows a distinct **COBRA** treatment (red-alert banner) — full cinematic styling lands in US-403, but a clear visual state ships here.
- [ ] Delta can move `threat`, `approval`, `capital` and cabinet standings; appends `keyHistory`.
- [ ] Works on both transports; typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

#### US-203: Cabinet reshuffle (personnel set-piece)
**Description:** As the PM, I want to promote, sack and move ministers so I can reshape my government —
with real consequences.

**Acceptance Criteria:**
- [ ] Reshuffle is reached via a queued PM action (US-106) or fires when resignations leave a hole.
- [ ] A reshuffle UI lists the current cabinet ([src/app/Dossier.tsx](src/app/Dossier.tsx) card style reused) and lets the player express moves (promote / sack / move) as structured choices.
- [ ] The intended reshuffle is serialised into `chosenAction`; the model narrates the fallout and returns a `cabinet` delta (`update`/`remove`/`add`) plus standing changes for the snubbed.
- [ ] Reshuffle risk (backbench anger, a sacking that plots) is expressed through the existing d100 + standing deltas, not invented by the model.
- [ ] Works on both transports; typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

#### US-204: Set-piece cadence & balance guardrail
**Description:** As a player, I want the mix of weeks to feel balanced between home and abroad and never
repetitive.

**Acceptance Criteria:**
- [ ] `scheduleTurnKind` enforces: no two set-pieces back-to-back unless crisis-driven; a rolling window keeps a **domestic/international balance** (e.g. it won't run three domestic set-pieces before an international one).
- [ ] Each `turnKind` is tagged `domestic` or `international` in one place; the balancer reads those tags.
- [ ] A deterministic test over N simulated weeks asserts the domestic:international set-piece ratio stays within a target band and no illegal clustering occurs.
- [ ] Typecheck + `npm test` pass.

---

### Phase 3 — Progress You Can Feel

#### US-301: Append-only stat-history buffer
**Description:** As the app, I need a record of past stat values so the UI can show trajectories.

**Acceptance Criteria:**
- [ ] Add `statHistory: { week, turnIndex, approval, reform, capital, whip, gilt, gbp, threat }[]` to schema (default `[]`), appended on each commit in [src/app/App.tsx](src/app/App.tsx)'s `commit` (or in the reducer).
- [ ] The buffer is capped (e.g. last ~60 samples) to keep saves small and phone-fast.
- [ ] Migration adds the field to old saves (empty history is acceptable).
- [ ] Append is deterministic and covered by a test.
- [ ] Typecheck + `npm test` pass.

#### US-302: HUD sparklines + trend arrows + weekly delta
**Description:** As the PM, I want to see whether a number is rising or falling and by how much, at a
glance.

**Acceptance Criteria:**
- [ ] The three HUD meters ([src/app/Play.tsx](src/app/Play.tsx), [src/app/meters.tsx](src/app/meters.tsx)) each show a tiny inline sparkline (SVG, from `statHistory`) and a `▲/▼/—` arrow with the last-turn delta (e.g. `38% ▼ −3`).
- [ ] Sparklines are pure SVG, no libraries, no network; render fine with a near-empty history.
- [ ] Colour follows existing tone helpers (`approvalTone`, `threatTone`).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-303: "Why it changed" post-turn trace
**Description:** As the PM, after a turn I want to understand *why* my numbers moved.

**Acceptance Criteria:**
- [ ] After applying a delta, the Play screen shows a compact trace of the stateBlock changes that were applied this turn (e.g. `Approval −3 · Capital −5 · Reform +1`), alongside the model's `keyHistoryAppend` line as the narrative "because".
- [ ] The trace is derived from the actual applied delta (code truth), not re-narrated by the model.
- [ ] Trace is dismissible and doesn't block the next choice.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-304: Premiership dashboard — domestic ↔ international at a glance
**Description:** As the PM, I want one view that shows my standing **at home and abroad** side by side,
so the game's balance is always visible.

**Acceptance Criteria:**
- [ ] Add a dashboard block (top of the State panel [src/app/StatePanel.tsx](src/app/StatePanel.tsx)) with two clearly separated columns: **Home** (approval, reform, whip, capital) and **World** (a derived *foreign-alignment index* = mean of `foreignCapitals[].read`, plus threat).
- [ ] The foreign-alignment index is computed in code and shown with a bipolar bar.
- [ ] Each side shows its trend from `statHistory` where available.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-305: Premiership timeline
**Description:** As the PM, I want to scroll the story of my time in office.

**Acceptance Criteria:**
- [ ] A timeline view (extend the Dossier "Key history" or a new sub-view) renders `keyHistory` as a vertical timeline, each entry stamped with week/date and, where available, the approval at that point from `statHistory`.
- [ ] Set-piece weeks are marked with their kind (e.g. a small "PMQs"/"Summit" tag on the entry).
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### Phase 4 — Narrative & Scene Richness

#### US-401: Rich document typology in RichText
**Description:** As a reader, I want wires, memos and front pages to *look* like wires, memos and front
pages — not identical grey text.

**Acceptance Criteria:**
- [ ] Extend [src/app/richtext.tsx](src/app/richtext.tsx) to classify a `*[…]*` document line by its label and render a matching style: **wire** (`Reuters/PA/AP` → monospace ticker), **flash** (`FCDO/COBRA/intel, e.g. B2` → letterhead + intelligence-tag chip), **note** (`PPS/Cabinet Office memo` → memo card), **front page** (`The Sun/Mail/Guardian/Times` → tabloid headline card).
- [ ] Classification is tolerant (unknown labels fall back to today's `rt-doc` style); still no `dangerouslySetInnerHTML`.
- [ ] Intelligence tags `[A1]…[D4]` inside prose get a subtle inline chip.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-402: Cast portrait system (cheap, deterministic)
**Description:** As the PM, I want faces for my cabinet and rivals so the cast feels human — without any
image pipeline.

**Acceptance Criteria:**
- [ ] Add a portrait component that renders a **deterministic SVG monogram/silhouette** from a cast member's `id`/`name` + `faction` colour (stable across reloads, no network, no `Math.random`).
- [ ] Portraits appear on Dossier cast/capital cards ([src/app/Dossier.tsx](src/app/Dossier.tsx)) and beside speakers in staged encounters where feasible.
- [ ] Fully offline; adds no dependencies.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-403: Set-piece cinematic styling
**Description:** As the PM, I want set-pieces to *look* distinct so each week has its own atmosphere.

**Acceptance Criteria:**
- [ ] Per-`turnKind` scene styling: COBRA red-alert frame, Summit flag/bilateral header (uses the capital), PMQs despatch-box/chamber motif, Budget red-box motif.
- [ ] Styling is CSS-only, respects the existing dark theme tokens in [src/app/app.css](src/app/app.css), and degrades gracefully on small screens.
- [ ] `standard` weeks are visually unchanged.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

#### US-404: Newspaper front-page beats
**Description:** As the PM, I want big press moments to hit like a front page.

**Acceptance Criteria:**
- [ ] When a scene contains a front-page document (from US-401) or a surfaced secret becomes a story, render a prominent full-width **front-page card** (masthead + headline + standfirst) instead of an inline line.
- [ ] Reuses US-401 classification; no new model contract required.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

### Phase 5 — The Balanced World Arc + Legacy

#### US-501: The locals as a real election-night set-piece
**Description:** As the PM, I want the May locals to *resolve* into a result, not just a countdown that
expires — but kept proportionate, not a local-politics grind.

**Acceptance Criteria:**
- [ ] When `daysToLocals` reaches zero, the scheduler fires an `election` set-piece: a single election-night scene plus a **code-computed result** (seats/vote share swing derived from `approval`, `reform`, and recent momentum in `statHistory`).
- [ ] The result feeds a delta that shifts `whip`/`capital`/`approval` and appends a decisive `keyHistory` line; a bad night can move `status` toward `wounded`.
- [ ] It is **one set-piece week**, not a multi-week campaign, to preserve the domestic/international balance.
- [ ] Result maths live in code and are unit-tested for monotonicity (higher approval → better night).
- [ ] Works on both transports; typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

#### US-502: International cadence beats
**Description:** As a player, I want the calendar to breathe between home and abroad, with recurring
world-stage moments (summits, treaty signings, allied crises).

**Acceptance Criteria:**
- [ ] Add a lightweight foreign-calendar to the engine (a small deterministic table of recurring international beats) that feeds the `summit`/`cobra` scheduling so the world stays active between domestic set-pieces.
- [ ] The US-204 balancer treats these as the international counterweight to domestic set-pieces.
- [ ] Deterministic; unit-tested; typecheck + `npm test` pass.

#### US-503: Clear win / loss / term end states
**Description:** As the PM, I want the game to have real ends — fall, defeat, or a term survived.

**Acceptance Criteria:**
- [ ] Define explicit end conditions in code (e.g. `status='lost'` = government falls; sustained collapse of `whip`/`capital`; a catastrophic election). Today only a `lost` banner exists in [src/app/Play.tsx](src/app/Play.tsx).
- [ ] Reaching an end state routes to a **resolution scene** rather than a dead-ended play screen.
- [ ] End detection is code-owned (not model-narrated) and unit-tested against threshold states.
- [ ] Typecheck + `npm test` pass.
- [ ] Verify in browser using dev-browser skill.

#### US-504: Premiership summary card (on-device, screenshot-shareable)
**Description:** As the PM, at the end I want a shareable summary of my time in office — without any
account or backend.

**Acceptance Criteria:**
- [ ] On reaching an end state, render a **summary card**: weeks survived, approval arc (from `statHistory`), 3–5 defining `keyHistory` moments, final home/world standing, and the manner of ending.
- [ ] The card is a normal on-device view the player can screenshot; **no share links, no upload, no backend.**
- [ ] Reachable later from Home for finished games.
- [ ] Typecheck passes.
- [ ] Verify in browser using dev-browser skill.

---

## Functional Requirements

**Set-piece engine**
- FR-1: The state schema must carry a code-owned `turnKind` and an optional `queuedTurnKind`.
- FR-2: `prepareTurn` must resolve the week's `turnKind` deterministically from queued action → threat → calendar → default, with no non-deterministic calls.
- FR-3: The prompt builder must inject a turn-kind-specific instruction module, compatible with **both** output contracts, and leave `standard` prompts byte-identical to today.
- FR-4: At least five set-pieces must ship — **PMQs, Budget, COBRA, Summit, Reshuffle** — tagged `domestic` or `international`.
- FR-5: Budget and Reshuffle must offer structured, phone-friendly interactions (allocation / personnel moves) that serialise into `chosenAction`, reusing the existing delta path.
- FR-6: A cadence balancer must prevent illegal clustering and keep a domestic↔international mix.
- FR-7: A player-actions affordance must let the player queue an eligible set-piece for the next turn.

**Progress & data-viz**
- FR-8: The app must persist a capped, append-only `statHistory`.
- FR-9: HUD meters must show sparkline + trend arrow + last-turn delta.
- FR-10: After each turn the app must show a code-derived "why it changed" trace of applied stateBlock deltas.
- FR-11: A dashboard must present **Home** and **World** standing side by side, including a derived foreign-alignment index.
- FR-12: A timeline must render `keyHistory` with week/date, set-piece tags, and approval context.

**Narrative richness**
- FR-13: RichText must classify and style documents (wire / flash / memo / front page) from their labels, with a safe fallback and no raw HTML injection.
- FR-14: The cast must have deterministic offline SVG portraits.
- FR-15: Each set-piece must have distinct CSS-only scene styling; front-page beats render as full-width cards.

**Cross-cutting**
- FR-16: Every new field must be optional/defaulted with a migration; old saves must keep loading.
- FR-17: Every feature must work with **no backend, no required API key, offline**, on both transports.
- FR-18: New engine logic must have pure-logic vitest coverage and preserve golden-replay determinism.

## Non-Goals (Out of Scope)

- **No backend, servers, accounts, logins, leaderboards, or multiplayer.**
- **No required API key or per-turn spend** — the subscription copy-paste relay stays the always-works default.
- **No AI image generation, external art, asset pipelines, or third-party CDNs/fonts.**
- **No share links / cloud sync / uploads** — sharing is by screenshot of an on-device card only.
- **No tilt into local-council micro-politics** — the electoral arc is one proportionate set-piece, not a campaign sub-game; the scheduler actively protects the domestic↔international balance.
- **No heavy multi-step tutorial** — onboarding stays as light as today.
- **No change to the core drift-proof contract** — the model never owns state, dice, or the schedule.

## Design Considerations

- **Reuse existing components/tokens:** `Gauge`, `BipolarBar`, `ThreatPips` ([src/app/meters.tsx](src/app/meters.tsx)); the card/section styles in [src/app/app.css](src/app/app.css); the Dossier person-card layout; the dark theme CSS variables. Add, don't reinvent.
- **Phone-first interactions:** allocation/reshuffle use taps/steppers/chips, not free-typing numbers; set-piece banners and cards must fit a phone viewport and respect safe-area insets already handled in the CSS.
- **Set-piece prompt modules** live together in `src/prompt/setpieces.ts` so voice/tuning is centralised and testable.
- **Visual restraint:** cinematic styling should read as *authored*, not gaudy — motifs (red box, despatch box, red-alert, flags) over heavy imagery, keeping the existing sober aesthetic.

## Technical Considerations

- **Schedule in `prepareTurn`** ([src/engine/turn.ts](src/engine/turn.ts)) so the kind is fixed before `buildTurnPrompt` runs and before dice are shown — keeping the whole turn reproducible from the seed.
- **Delta compatibility:** Budget/Reshuffle/Election produce nothing the reducer can't already apply (`stateBlock`, `cabinet`, `foreignCapitals`, `keyHistoryAppend`); prefer serialising structured player intent into `chosenAction` over widening the `TurnDelta` schema.
- **Migrations:** bump `SCHEMA_VERSION` once for Phase 1 and again as later phases add fields; each migration is additive with safe defaults ([src/state/migrations.ts](src/state/migrations.ts)).
- **Both transports:** verify each set-piece on the copy-paste path *and* the API path — the API adapters ([src/llm/](src/llm/)) must receive the same set-piece-augmented prompt.
- **Save size:** cap `statHistory`; portraits are computed, not stored; keep the export/import save format from [src/persistence/store.ts](src/persistence/store.ts) lean.
- **Determinism tests:** extend the existing golden-replay tests so a fixed seed + fixed choices reproduce identical set-piece scheduling and election maths.

## Success Metrics

- **Variety:** across a 20-week simulated run, at least 5 distinct `turnKind`s appear and no more than ~50% of weeks are `standard`.
- **Balance:** domestic and international set-pieces occur within a target ratio band (e.g. between 40:60 and 60:40) and never cluster illegally — enforced and asserted by test.
- **Legibility:** after any turn, the player can see, without opening a menu, the direction and size of change for approval/reform/threat, and a one-line reason.
- **Simplicity preserved:** the app still builds to a static site, runs offline, needs no key to play, and adds zero new required setup steps.
- **No regression:** `standard` turns, existing saves (via migration), and both transports continue to work; all existing tests stay green.

## Open Questions

- **PMQs cadence:** fixed rhythm (e.g. every 4th eligible week) or event-driven (after a bad news cycle)? Start fixed, revisit.
- **Budget levers:** how many departments/levers keep it meaningful but still one-thumb on a phone — 4? 6?
- **COBRA & the week clock:** should every COBRA be intraday (`advanceWeeks: 0`), or only the most severe? Proposed: severe only.
- **Election scope creep:** are by-elections wanted as occasional single-week beats, or only the scheduled locals/GE? Default: locals/GE only, to protect the balance.
- **Reshuffle authorship:** does the player pick exact replacements, or set intent ("sack the Chancellor, promote a loyalist") and let the model cast within faction constraints? Proposed: intent-led, code-constrained.
- **Legacy card depth:** minimal stats card first, or include a shareable "front page of your resignation" styled render from day one?
