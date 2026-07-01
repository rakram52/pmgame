import type { GameState, Risk, TurnKind } from '../state/schema'
import { prepareTurn } from '../engine/turn'
import { buildTurnPrompt } from '../prompt/builder'
import { extractDelta, type DeltaExtraction } from '../state/delta'
import { applyDelta } from '../state/reducer'
import type { Connection } from '../llm/types'
import { callModel } from '../llm/client'
import { describeLlmError } from '../llm/errors'

/**
 * Glue between the pure engine/reducer and the UI.
 *   - Copy-paste transport: prepareAndBuild → user relays → applyReply.
 *   - Direct-API transport: chooseAction → runTurnAuto (calls the model, parses,
 *     auto-repairs, commits) in one step.
 */

/** Record the PM's chosen action, then roll + build the prompt for it.
 *  `seedInjections` lets a structured set-piece (e.g. the Budget) pre-load an
 *  engine directive that survives into this turn's prompt. */
export function chooseAction(state: GameState, action: string, risk: Risk | null, seedInjections: string[] = []): GameState {
  const next: GameState = {
    ...structuredClone(state),
    chosenAction: action,
    chosenRisk: risk,
    pendingRolls: null, // force a fresh roll for this decision
    pendingInjections: [...seedInjections],
    lastPrompt: '',
    lastRawReply: '',
  }
  return prepareAndBuild(next)
}

/** Queue a player-initiated set-piece for the NEXT turn (US-106). A direct state
 *  edit — it doesn't advance a turn; the scheduler consumes it next `prepareTurn`. */
export function queueTurnKind(state: GameState, kind: TurnKind | null): GameState {
  return { ...structuredClone(state), queuedTurnKind: kind }
}

/** Ensure the turn is rolled and the copy-paste prompt is built (idempotent per turn). */
export function prepareAndBuild(state: GameState): GameState {
  const prepped = prepareTurn(state)
  const prompt = buildTurnPrompt(prepped)
  return { ...prepped, lastPrompt: prompt }
}

export type ApplyResult =
  | { ok: true; state: GameState; warnings: string[]; prose: string }
  | { ok: false; failure: Extract<DeltaExtraction, { ok: false }> }

/** Parse a raw model reply and commit it. State is untouched on failure.
 *  On the API path the narrative rides inside the JSON, so `scene` wins as prose. */
export function applyReply(state: GameState, raw: string): ApplyResult {
  const ext = extractDelta(raw)
  if (!ext.ok) return { ok: false, failure: ext }
  const prose = ext.delta.scene?.trim() ? ext.delta.scene.trim() : ext.prose
  const { state: next, warnings } = applyDelta(state, ext.delta, prose)
  next.lastRawReply = raw
  return { ok: true, state: next, warnings, prose }
}

export type AutoResult =
  | { ok: true; state: GameState; warnings: string[] }
  | { ok: false; error: string; prompt: string }

/**
 * Direct-API turn: roll → call the model → parse/validate → auto-repair (≤2) →
 * commit. Atomic: state is only advanced on success. On failure returns the
 * chat-mode prompt so the UI can fall back to copy-paste for this turn.
 */
export async function runTurnAuto(state: GameState, conn: Connection, signal?: AbortSignal): Promise<AutoResult> {
  const prepped = prepareTurn(state)
  const apiPrompt = buildTurnPrompt(prepped, 'api')
  const chatPrompt = buildTurnPrompt(prepped, 'chat')
  // Keep the prepared (rolled) state so a copy-paste fallback uses the same dice.
  const base: GameState = { ...prepped, lastPrompt: chatPrompt }

  let prompt = apiPrompt
  let lastError = 'Unknown error.'
  for (let attempt = 0; attempt < 3; attempt++) {
    let raw: string
    try {
      raw = await callModel(conn, prompt, signal)
    } catch (e) {
      return { ok: false, error: describeLlmError(e), prompt: chatPrompt }
    }
    const ext = extractDelta(raw)
    if (ext.ok) {
      const prose = ext.delta.scene?.trim() ? ext.delta.scene.trim() : ext.prose
      const { state: next, warnings } = applyDelta(base, ext.delta, prose)
      next.lastRawReply = raw
      return { ok: true, state: next, warnings }
    }
    lastError = ext.error
    // Ask the model to fix just the JSON, then retry.
    prompt = `${apiPrompt}\n\n━━━ YOUR PREVIOUS REPLY FAILED VALIDATION ━━━\n${ext.error}\nRe-send ONLY the corrected single JSON object (scene + options + any changes). No prose outside the JSON.`
  }
  return { ok: false, error: `Model output failed validation after retries: ${lastError}`, prompt: chatPrompt }
}
