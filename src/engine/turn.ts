import type { GameState, PendingRolls } from '../state/schema'
import { Rng } from './rng'
import { resolveAction } from './resolve'
import { rollWorldVariance, maybeRollEvent } from './events'
import { scheduleTurnKind, summitFocusCapital } from './schedule'
import { computeElectionResult } from './setpieceLogic'
import { isMultiBeat, TURN_KIND_META } from './turnKinds'
import { SETTLING_WEEKS } from './pacing'

export { scheduleTurnKind } from './schedule'

/**
 * Everything the engine rolls for a turn, BEFORE the prompt is built. It runs
 * exactly once per turn (guarded by pendingRolls === null). All draws come from
 * the seeded PRNG in a fixed order, and the rng counter is advanced so the save
 * stays perfectly reproducible.
 *
 * Produces: pendingRolls (action resolution + world variance + random event)
 * and pendingInjections (fired scheduled consequences + surfaced secrets +
 * event directive) — the directives the prompt builder must weave in.
 */
export function prepareTurn(input: GameState): GameState {
  const state: GameState = structuredClone(input)
  if (state.pendingRolls) return state // already prepared this turn

  const rng = new Rng(state.rng.seed, state.rng.counter)
  // Seed from any injections a set-piece UI pre-loaded (e.g. Budget headroom).
  const injections: string[] = [...state.pendingInjections]
  const rolls: PendingRolls = { action: null, worldVariance: null, event: null }

  // Are we already INSIDE a live encounter (i.e. this is a continuation beat)?
  // On the beat that OPENS a scene, activeScene is still null here — so the
  // opening beat runs the world normally; only beats 2..N pause it.
  const continuingScene = state.activeScene !== null

  // 1. Action resolution (only for real decisions, not the opening scene).
  if (state.chosenAction.trim()) {
    rolls.action = resolveAction(rng, state, state.chosenRisk ?? 'moderate')
  }

  // 2..5. The world machinery. SUPPRESSED while inside a live encounter — you
  // are in the room and the clock is held, so no fresh events, consequences or
  // leaks intrude mid-conversation. The opening beat and ordinary turns run it.
  if (!continuingScene) {
    // 2. World variance — every (non-encounter) turn.
    rolls.worldVariance = rollWorldVariance(rng)

    // 3. Random event — every 3rd turn, on a 6+.
    const ev = maybeRollEvent(rng, state.turnIndex, state.lastEventCategory)
    if (ev) {
      rolls.event = ev
      state.lastEventCategory = ev.category
      injections.push(`RANDOM EVENT (${ev.title}): ${ev.directive}`)
    }

    // Settling-in grace: hold back pre-planted consequences and secret exposures
    // in the opening weeks so the PM can set direction before the world bites.
    const pastSettling = state.calendar.week > SETTLING_WEEKS

    // 4. Scheduled doctrine consequences whose week has arrived.
    if (pastSettling) {
      for (const pc of state.pendingConsequences) {
        if (!pc.fired && pc.dueWeek != null && pc.dueWeek <= state.calendar.week) {
          pc.fired = true
          injections.push(`SCHEDULED CONSEQUENCE NOW IN PLAY: ${pc.description}`)
        }
      }
    }

    // 5. Buried-but-live: each untriggered secret gets a per-turn exposure roll.
    if (pastSettling) {
      for (const secret of state.buriedButLive) {
        if (!secret.triggered && rng.d(100) <= secret.exposureRisk) {
          secret.triggered = true
          injections.push(`A BURIED STORY NOW SURFACES: ${secret.title} — ${secret.detail}`)
        }
      }
    }
  }

  // Attach rolls BEFORE scheduling so the scheduler can react to a fresh event.
  state.pendingRolls = rolls

  // 6. Resolve this week's KIND in code (drift-proof). Must come after the event
  //    roll and before the prompt is built. A live encounter keeps its kind.
  const kind = scheduleTurnKind(state, rng)
  state.turnKind = kind

  // 7. Live-encounter lifecycle. A scheduled multi-beat set-piece OPENS its scene
  //    here; a continuation beat advances to the next beat. (Contextual 1:1s are
  //    opened by the reducer from the narrator's `encounter` signal, then flow
  //    through this same beat-advance.) The engine owns the beat count.
  if (state.activeScene) {
    if (state.activeScene.beat < state.activeScene.maxBeats) {
      state.activeScene = { ...state.activeScene, beat: state.activeScene.beat + 1 }
    }
  } else if (isMultiBeat(kind)) {
    state.activeScene = { kind, focus: sceneFocus(kind, state, rolls), beat: 1, maxBeats: TURN_KIND_META[kind].beats }
  }

  // 8. Per-kind context + engine-computed numbers the model must narrate. The
  //    encounter's focus (capital / crisis label) rides on activeScene so it
  //    survives across beats even once the world rolls are suppressed.
  state.setpieceContext = state.activeScene?.focus ?? ''
  if (kind === 'election') {
    const result = computeElectionResult(state)
    injections.push(result.injection)
  }

  state.rng.counter = rng.counter
  state.pendingInjections = injections
  return state
}

/** What a freshly-opened set-piece encounter centres on (persisted on
 *  activeScene.focus). Summit → most hostile capital; COBRA → the event title. */
function sceneFocus(kind: GameState['turnKind'], state: GameState, rolls: PendingRolls): string {
  if (kind === 'summit') return summitFocusCapital(state)
  if (kind === 'cobra') return rolls.event?.title ?? 'Security'
  return ''
}
