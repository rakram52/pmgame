import type { GameState, PendingRolls } from '../state/schema'
import { Rng } from './rng'
import { resolveAction } from './resolve'
import { rollWorldVariance, maybeRollEvent } from './events'

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
  const injections: string[] = []
  const rolls: PendingRolls = { action: null, worldVariance: null, event: null }

  // 1. Action resolution (only for real decisions, not the opening scene).
  if (state.chosenAction.trim()) {
    rolls.action = resolveAction(rng, state, state.chosenRisk ?? 'moderate')
  }

  // 2. World variance — every turn.
  rolls.worldVariance = rollWorldVariance(rng)

  // 3. Random event — every 3rd turn, on a 6+.
  const ev = maybeRollEvent(rng, state.turnIndex, state.lastEventCategory)
  if (ev) {
    rolls.event = ev
    state.lastEventCategory = ev.category
    injections.push(`RANDOM EVENT (${ev.title}): ${ev.directive}`)
  }

  // 4. Scheduled doctrine consequences whose week has arrived.
  for (const pc of state.pendingConsequences) {
    if (!pc.fired && pc.dueWeek != null && pc.dueWeek <= state.calendar.week) {
      pc.fired = true
      injections.push(`SCHEDULED CONSEQUENCE NOW IN PLAY: ${pc.description}`)
    }
  }

  // 5. Buried-but-live: each untriggered secret gets a per-turn exposure roll.
  for (const secret of state.buriedButLive) {
    if (!secret.triggered && rng.d(100) <= secret.exposureRisk) {
      secret.triggered = true
      injections.push(`A BURIED STORY NOW SURFACES: ${secret.title} — ${secret.detail}`)
    }
  }

  state.rng.counter = rng.counter
  state.pendingRolls = rolls
  state.pendingInjections = injections
  return state
}
