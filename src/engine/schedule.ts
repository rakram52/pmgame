import type { GameState, TurnKind } from '../state/schema'
import type { Rng } from './rng'
import { TURN_KIND_META, isSetpiece } from './turnKinds'
import { CAPITAL_LEADERS } from '../game/links'

/**
 * The set-piece scheduler — the drift-proof heart of the varied turn loop.
 * Which kind a week is gets decided HERE, in code, from the calendar + state,
 * never by the model. Pure and deterministic: no Date.now / Math.random (any
 * randomness comes from the seeded Rng only), so replays stay identical.
 */

// ---------------------------------------------------------------------------
// Calendar helpers (no Date.now — parse the ISO string directly)
// ---------------------------------------------------------------------------

/** Month 1..12 from a 'YYYY-MM-DD' string. */
export function monthOf(iso: string): number {
  const m = /^\d{4}-(\d{2})/.exec(iso)
  return m ? Number(m[1]) : 1
}

/** The House rises for the long summer recess — a light approximation so PMQs
 *  doesn't fire when the Commons isn't sitting. */
export function houseSitting(iso: string): boolean {
  return monthOf(iso) !== 8
}

/** The autumn fiscal-event window (a single scheduled Budget per November). */
function budgetWindow(iso: string): boolean {
  return monthOf(iso) === 11
}

// ---------------------------------------------------------------------------
// Foreign calendar (US-502) — recurring world-stage beats between home weeks
// ---------------------------------------------------------------------------

/** A summit beat is due on a steady international cadence (every 6 weeks from
 *  week 5), so the world stays active between domestic set-pieces. Deterministic. */
export function foreignBeatDue(week: number): boolean {
  return week >= 5 && (week - 5) % 6 === 0
}

// ---------------------------------------------------------------------------
// Set-piece log helpers
// ---------------------------------------------------------------------------

function recentlyHeld(state: GameState, kind: TurnKind, withinTurns: number): boolean {
  return state.setpieceHistory.some((h) => h.kind === kind && state.turnIndex - h.turnIndex < withinTurns)
}

/** The scopes of the last two *scheduled* (non-reactive) set-pieces — the window
 *  the balancer uses to stop three domestic (or three international) in a row. */
function recentScheduledScopes(state: GameState): (string | null)[] {
  return state.setpieceHistory
    .filter((h) => TURN_KIND_META[h.kind].scope && !TURN_KIND_META[h.kind].reactive)
    .slice(-2)
    .map((h) => TURN_KIND_META[h.kind].scope)
}

// ---------------------------------------------------------------------------
// The scheduler
// ---------------------------------------------------------------------------

function isOpening(state: GameState): boolean {
  return !state.chosenAction.trim() && !state.options
}

/** Which capital a summit should centre on: the most hostile read that still has
 *  a named leader (deterministic; ties break by declaration order). */
export function summitFocusCapital(state: GameState): string {
  const withLeaders = state.foreignCapitals.filter((c) => CAPITAL_LEADERS[c.name])
  const pool = withLeaders.length ? withLeaders : state.foreignCapitals
  if (!pool.length) return ''
  let pick = pool[0]
  for (const c of pool) if (c.read < pick.read) pick = c
  return pick.name
}

/**
 * Resolve this week's kind. Priority (highest first):
 *   queued player action → election night → crisis COBRA → event-driven
 *   COBRA/summit → calendar-cadence set-piece (balance-guarded) → standard.
 *
 * Reads `state.pendingRolls.event` (already rolled this turn) to react to a
 * fresh security/foreign event, so must be called AFTER the event roll.
 */
export function scheduleTurnKind(state: GameState, rng: Rng): TurnKind {
  // The establishing scene is always standard.
  if (isOpening(state)) return 'standard'

  // 1. A player-queued set-piece wins outright.
  if (state.queuedTurnKind && state.queuedTurnKind !== 'standard') return state.queuedTurnKind

  // 2. Election night: the locals countdown has expired (and we haven't just held it).
  if (state.calendar.daysToLocals <= 0 && !recentlyHeld(state, 'election', 4)) return 'election'

  // 3. Crisis → COBRA when the threat board is hot.
  if (state.stateBlock.threat >= 4) return 'cobra'

  // 4. React to an event that fired THIS turn.
  const ev = state.pendingRolls?.event
  if (ev) {
    if (ev.category === 2) return 'cobra' // security / terror incident
    if (ev.category === 4) return 'summit' // foreign crisis → summit table
  }

  // 5. Calendar-cadence set-pieces, subject to the balance guardrail.
  return scheduledSetpiece(state, rng)
}

function eligible(state: GameState, kind: TurnKind): boolean {
  if (kind === 'summit') return state.foreignCapitals.length > 0
  if (kind === 'pmqs') return houseSitting(state.calendar.dateISO)
  return true
}

function scheduledSetpiece(state: GameState, _rng: Rng): TurnKind {
  // No scheduled set-piece directly after any set-piece (never back-to-back).
  if (isSetpiece(state.turnKind)) return 'standard'

  const w = state.calendar.week
  let cand: TurnKind | null = null
  if (budgetWindow(state.calendar.dateISO) && !recentlyHeld(state, 'budget', 20)) cand = 'budget'
  else if (foreignBeatDue(w) && eligible(state, 'summit')) cand = 'summit'
  else if (w % 4 === 0 && eligible(state, 'pmqs')) cand = 'pmqs'
  else if (w % 6 === 0 && eligible(state, 'summit')) cand = 'summit'

  if (!cand) return 'standard'
  return balance(state, cand)
}

/**
 * Keep home and abroad in balance: never let a third scheduled set-piece of the
 * same scope run before the other side gets one. Fixed/crisis (reactive) kinds
 * are exempt — they fire when the world demands.
 */
function balance(state: GameState, cand: TurnKind): TurnKind {
  const meta = TURN_KIND_META[cand]
  if (meta.reactive || !meta.scope) return cand

  const recent = recentScheduledScopes(state)
  const twoSame = recent.length >= 2 && recent.every((s) => s === meta.scope)
  if (!twoSame) return cand

  // Substitute the opposite scope if it's eligible, else defer to a standard week.
  const opposite: TurnKind = meta.scope === 'domestic' ? 'summit' : 'pmqs'
  return eligible(state, opposite) ? opposite : 'standard'
}
