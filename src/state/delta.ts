import { z } from 'zod'
import { TurnOptionsSchema, OptionRisksSchema, FactionSchema, TrendSchema, LoopStatusSchema, StatusSchema } from './schema'

/**
 * The TurnDelta is the ONLY machine-readable thing the model must emit. It is
 * deliberately small, flat, op-based and forgiving:
 *   - `options` is the single required field (it drives the choice buttons).
 *   - Every numeric change is a DELTA (+/-), never an absolute — the reducer
 *     clamps, so a wrong number can never push state out of range.
 *   - Unknown keys are stripped by Zod (default), so a hallucinated field is
 *     harmless rather than fatal.
 */

export const TurnDeltaSchema = z.object({
  options: TurnOptionsSchema,
  /** Optional risk tag per option, declared BEFORE the player chooses (so it
   *  can't be gamed toward a desired outcome). Drives the honest d100. */
  optionRisks: OptionRisksSchema.optional(),

  /** Deltas keyed by state-block row (approval, reform, capital, whip, gilt,
   *  gbp, threat, or any custom row key). */
  stateBlock: z.record(z.string(), z.number()).optional(),
  /** Introduce a new tracked numeric row. */
  addStats: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        value: z.number(),
        min: z.number().optional(),
        max: z.number().optional(),
        suffix: z.string().optional(),
      }),
    )
    .optional(),

  calendar: z
    .object({
      advanceWeeks: z.number().optional(),
      setDateISO: z.string().optional(),
      daysToLocalsDelta: z.number().optional(),
    })
    .optional(),

  openLoops: z
    .object({
      add: z
        .array(
          z.object({
            who: z.string().optional(),
            title: z.string(),
            detail: z.string().optional(),
            dueInWeeks: z.number().optional(),
          }),
        )
        .optional(),
      update: z
        .array(
          z.object({
            id: z.string(),
            detail: z.string().optional(),
            dueWeekDelta: z.number().optional(),
            status: LoopStatusSchema.optional(),
          }),
        )
        .optional(),
      resolve: z
        .array(
          z.object({
            id: z.string(),
            outcome: z.enum(['delivered', 'resolved', 'failed', 'buried', 'leaked']).optional(),
            note: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),

  streams: z
    .object({
      add: z
        .array(z.object({ name: z.string(), reading: z.string().optional(), trend: TrendSchema.optional() }))
        .optional(),
      update: z
        .array(z.object({ id: z.string(), reading: z.string().optional(), trend: TrendSchema.optional() }))
        .optional(),
    })
    .optional(),

  cabinet: z
    .object({
      add: z
        .array(
          z.object({
            name: z.string(),
            role: z.string(),
            faction: FactionSchema.optional(),
            agenda: z.string().optional(),
          }),
        )
        .optional(),
      update: z
        .array(
          z.object({
            id: z.string(),
            standingDelta: z.number().optional(),
            agenda: z.string().optional(),
            notes: z.string().optional(),
          }),
        )
        .optional(),
      remove: z.array(z.object({ id: z.string(), reason: z.string().optional() })).optional(),
    })
    .optional(),

  /** Update a capital by id OR name; the reducer resolves name → id. */
  foreignCapitals: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().optional(),
        readDelta: z.number().optional(),
        posture: z.string().optional(),
      }),
    )
    .optional(),

  buriedButLive: z
    .object({
      add: z
        .array(z.object({ title: z.string(), detail: z.string().optional(), exposureRisk: z.number().optional() }))
        .optional(),
      trigger: z.array(z.object({ id: z.string(), note: z.string().optional() })).optional(),
    })
    .optional(),

  keyHistoryAppend: z.string().optional(),
  narrativeSummary: z.string().optional(),
  statusHint: StatusSchema.optional(),
})
export type TurnDelta = z.infer<typeof TurnDeltaSchema>

// ---------------------------------------------------------------------------
// Extraction + forgiving parse
// ---------------------------------------------------------------------------

export type DeltaExtraction =
  | { ok: true; prose: string; delta: TurnDelta; warnings: string[] }
  | { ok: false; prose: string; error: string; stage: 'fence' | 'json' | 'schema' }

const SENTINEL_RE = /<<<DELTA([\s\S]*?)DELTA>>>/gi
const FENCE_RE = /```(?:delta|json)?\s*([\s\S]*?)```/gi

/** Pull the last matching block for a given regex (models sometimes restate). */
function lastMatch(raw: string, re: RegExp): string | null {
  let m: RegExpExecArray | null
  let last: string | null = null
  re.lastIndex = 0
  while ((m = re.exec(raw)) !== null) last = m[1]
  return last
}

/** Everything outside the delta block, trimmed — the narrative prose. */
export function extractProse(raw: string): string {
  return raw
    .replace(SENTINEL_RE, '')
    .replace(/```(?:delta|json)[\s\S]*?```/gi, '')
    .trim()
}

/** Tolerate the small JSON sins chat models commit. */
function cleanJson(s: string): string {
  return s
    .replace(/^﻿/, '')
    .replace(/\/\/[^\n\r]*/g, '') // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/,\s*([}\]])/g, '$1') // trailing commas
    .trim()
}

function findRawBlock(raw: string): string | null {
  const sentinel = lastMatch(raw, SENTINEL_RE)
  if (sentinel) return sentinel
  // Fallback: a fenced block that looks like it holds our delta.
  let m: RegExpExecArray | null
  let candidate: string | null = null
  FENCE_RE.lastIndex = 0
  while ((m = FENCE_RE.exec(raw)) !== null) {
    if (m[1].includes('"options"')) candidate = m[1]
  }
  return candidate
}

/**
 * Extract prose + validated delta from a raw model reply. Never throws:
 * returns a discriminated result so the UI can drive the repair flow.
 */
export function extractDelta(raw: string): DeltaExtraction {
  const prose = extractProse(raw)
  const block = findRawBlock(raw)
  if (!block) {
    return { ok: false, prose, error: 'No <<<DELTA … DELTA>>> block found in the reply.', stage: 'fence' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleanJson(block))
  } catch (e) {
    return { ok: false, prose, error: `Delta block is not valid JSON: ${(e as Error).message}`, stage: 'json' }
  }

  const result = TurnDeltaSchema.safeParse(parsed)
  if (!result.success) {
    const summary = result.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')
    return { ok: false, prose, error: summary, stage: 'schema' }
  }

  return { ok: true, prose, delta: result.data, warnings: [] }
}
