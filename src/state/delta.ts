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
  /** The narrative prose. REQUIRED on the API path (where the whole reply is one
   *  JSON object); omitted on the copy-paste path (prose sits outside the block). */
  scene: z.string().optional(),
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

// The open is <<<DELTA (any inner whitespace); the close is DELTA followed by
// TWO OR MORE '>'. Models sometimes drop or add a bracket (DELTA>> / DELTA>>>>),
// which previously leaked the raw JSON into the scene because the strict prose
// stripper only recognised exactly "DELTA>>>". Locating and stripping now share
// one tolerant path so whatever gets PARSED as the delta also gets REMOVED.
const OPEN_RE = /<<<\s*DELTA\b/i
const CLOSE_RE = /DELTA\s*>>+/i
const FENCE_RE = /```(?:delta|json)?\s*([\s\S]*?)```/gi

interface Located {
  json: string
  /** [start, end) span of the whole block in raw, to remove from the prose. */
  start: number
  end: number
}

/** Find the delta JSON to parse AND the exact span to strip from the prose.
 *  Tries, in order: a <<<DELTA … DELTA>>> sentinel (tolerant of a broken or
 *  missing close), a fenced json/delta block, then a bare trailing JSON object. */
function locateDelta(raw: string): Located | null {
  // 1. Sentinel form. Use the LAST opening (models sometimes restate).
  const openG = new RegExp(OPEN_RE.source, 'ig')
  let m: RegExpExecArray | null
  let lastOpen: RegExpExecArray | null = null
  while ((m = openG.exec(raw)) !== null) lastOpen = m
  if (lastOpen) {
    const contentStart = lastOpen.index + lastOpen[0].length
    const closeG = new RegExp(CLOSE_RE.source, 'ig')
    closeG.lastIndex = contentStart
    const closeM = closeG.exec(raw)
    if (closeM) {
      return { json: raw.slice(contentStart, closeM.index), start: lastOpen.index, end: closeM.index + closeM[0].length }
    }
    // Opened but never properly closed — take the JSON object that follows and
    // absorb any stray "DELTA>" / "DELTA" tail so it can't leak into the scene.
    const seg = raw.slice(contentStart)
    const s = seg.indexOf('{')
    const e = seg.lastIndexOf('}')
    if (s !== -1 && e > s) {
      let end = contentStart + e + 1
      const tail = /^\s*DELTA\s*>*/i.exec(raw.slice(end))
      if (tail) end += tail[0].length
      return { json: seg.slice(s, e + 1), start: lastOpen.index, end }
    }
    return null
  }

  // 2. Fenced block that looks like our delta (contains "options"). Take last.
  let fm: RegExpExecArray | null
  let lastFence: RegExpExecArray | null = null
  FENCE_RE.lastIndex = 0
  while ((fm = FENCE_RE.exec(raw)) !== null) if (fm[1].includes('"options"')) lastFence = fm
  if (lastFence) return { json: lastFence[1], start: lastFence.index, end: lastFence.index + lastFence[0].length }

  // 3. Bare trailing JSON object (API path), only if it holds our delta.
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start !== -1 && end > start && raw.slice(start, end + 1).includes('"options"')) {
    return { json: raw.slice(start, end + 1), start, end: end + 1 }
  }
  return null
}

/** Remove any delta blocks (tolerant of a broken/missing close) so the raw JSON
 *  can never appear in the narrated scene. */
function stripBlocks(raw: string): string {
  return raw
    .replace(/<<<\s*DELTA[\s\S]*?DELTA\s*>>+/gi, '') // closed sentinel (>> or more)
    .replace(/<<<\s*DELTA[\s\S]*$/i, '') // an opened-but-unclosed sentinel → to end
    .replace(/```(?:delta|json)[\s\S]*?```/gi, '') // fenced json/delta block
    .trim()
}

/** Everything outside the delta block, trimmed — the narrative prose. */
export function extractProse(raw: string): string {
  return stripBlocks(raw)
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

/**
 * Extract prose + validated delta from a raw model reply. Never throws:
 * returns a discriminated result so the UI can drive the repair flow.
 */
export function extractDelta(raw: string): DeltaExtraction {
  const located = locateDelta(raw)
  if (!located) {
    return { ok: false, prose: stripBlocks(raw), error: 'No <<<DELTA … DELTA>>> block found in the reply.', stage: 'fence' }
  }
  // Prose = raw with the located block removed, then any stray blocks stripped.
  const prose = stripBlocks(raw.slice(0, located.start) + raw.slice(located.end))

  let parsed: unknown
  try {
    parsed = JSON.parse(cleanJson(located.json))
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
