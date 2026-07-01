import type { GameState, Risk } from '../state/schema'
import { prepareTurn } from '../engine/turn'
import { buildTurnPrompt } from '../prompt/builder'
import { extractDelta, type DeltaExtraction } from '../state/delta'
import { applyDelta } from '../state/reducer'

/**
 * Glue between the pure engine/reducer and the UI. Two moves per turn:
 *   1. prepareAndBuild — roll the dice (once) and produce the copy-ready prompt.
 *   2. applyReply     — parse the model's reply and commit the delta (atomic).
 */

/** Record the PM's chosen action, then roll + build the prompt for it. */
export function chooseAction(state: GameState, action: string, risk: Risk | null): GameState {
  const next: GameState = {
    ...structuredClone(state),
    chosenAction: action,
    chosenRisk: risk,
    pendingRolls: null, // force a fresh roll for this decision
    pendingInjections: [],
    lastPrompt: '',
    lastRawReply: '',
  }
  return prepareAndBuild(next)
}

/** Ensure the turn is rolled and the prompt is built (idempotent per turn). */
export function prepareAndBuild(state: GameState): GameState {
  const prepped = prepareTurn(state)
  const prompt = buildTurnPrompt(prepped)
  return { ...prepped, lastPrompt: prompt }
}

export type ApplyResult =
  | { ok: true; state: GameState; warnings: string[]; prose: string }
  | { ok: false; failure: Extract<DeltaExtraction, { ok: false }> }

/** Parse a raw model reply and commit it. State is untouched on failure. */
export function applyReply(state: GameState, raw: string): ApplyResult {
  const ext = extractDelta(raw)
  if (!ext.ok) return { ok: false, failure: ext }
  const { state: next, warnings } = applyDelta(state, ext.delta, ext.prose)
  next.lastRawReply = raw
  return { ok: true, state: next, warnings, prose: ext.prose }
}
