import type { DeltaExtraction } from '../state/delta'

/** When a reply fails to parse, this is the short prompt the player pastes back
 *  into the SAME chat to make the model re-emit a valid delta. State stays put
 *  on the current turn until a valid delta lands (atomic). */
export function buildRepairPrompt(failure: Extract<DeltaExtraction, { ok: false }>): string {
  const reason =
    failure.stage === 'fence'
      ? 'no <<<DELTA … DELTA>>> block was found'
      : failure.stage === 'json'
        ? `the JSON was invalid (${failure.error})`
        : `the JSON failed validation (${failure.error})`

  return `Your last reply could not be applied because ${reason}.

Re-emit ONLY the delta block for the scene you just wrote — nothing else, no prose, no markdown fences. It must be:

<<<DELTA
{ "options": { "A": "...", "B": "...", "C": "..." }, ...any state changes... }
DELTA>>>

Valid JSON: double-quoted keys, no trailing commas, no comments. "options" with A, B and C is required. Numbers must be small deltas, never absolutes.`
}
