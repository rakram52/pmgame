import type { GameState, TurnKind, OpenLoop } from '../state/schema'
import { TERMINAL_LOOP_STATUSES } from '../state/schema'
import type { Rng } from './rng'
import { isSetpiece } from './turnKinds'
import { CAPITAL_LEADERS, loopsForCapital } from '../game/links'
import { approvalMomentum } from './setpieceLogic'

/**
 * The set-piece scheduler — the drift-proof heart of the varied turn loop.
 * Which kind a week is gets decided HERE, in code, from the calendar + state,
 * never by the model. Pure and deterministic: no Date.now / Math.random (any
 * randomness comes from the seeded Rng only), so replays stay identical.
 *
 * Set-pieces are EARNED, not run on a cadence. A summit is the payoff of a
 * foreign thread the PM has been building; PMQs is the House coming for a
 * politically exposed PM; COBRA answers a real crisis; the Budget is the one
 * fixed autumn fixture; election night is the locals countdown expiring. Nothing
 * is sprung on a "week % N" tick — the world builds to it or it doesn't happen.
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
// Earned-trigger helpers
// ---------------------------------------------------------------------------

function recentlyHeld(state: GameState, kind: TurnKind, withinTurns: number): boolean {
  return state.setpieceHistory.some((h) => h.kind === kind && state.turnIndex - h.turnIndex < withinTurns)
}

/** A live (non-terminal) loop whose deadline has arrived. */
function isDue(loop: OpenLoop, week: number): boolean {
  return !TERMINAL_LOOP_STATUSES.includes(loop.status) && loop.dueWeek <= week
}

/** Loop text that reads like arranging a face-to-face / channel with a capital —
 *  the groundwork a summit is the payoff of. */
const ENGAGEMENT_RE = /\b(summit|bilateral|meeting|meet|talks?|negotiat|visit|call|phone|face.?to.?face|deal|accord|treaty|channel|back.?channel|envoy|delegation)\b/i

function isEngagementLoop(l: OpenLoop): boolean {
  return ENGAGEMENT_RE.test(l.title) || ENGAGEMENT_RE.test(l.detail) || ENGAGEMENT_RE.test(l.who)
}

/** The capital a summit has been EARNED for: a live engagement loop the PM set in
 *  motion has now come due. Null when no foreign thread has ripened. Deterministic
 *  (first such capital in declaration order). */
export function ripeSummitCapital(state: GameState): string | null {
  const week = state.calendar.week
  for (const c of state.foreignCapitals) {
    const loops = loopsForCapital(state.openLoops, c)
    if (loops.some((l) => isDue(l, week) && isEngagementLoop(l))) return c.name
  }
  return null
}

/** Is the PM politically exposed enough that the House would come for them at the
 *  despatch box? Approval sliding fast, the whip gone sour, a stack of tasks left
 *  to rot, or approval simply low. (No cadence — PMQs is earned by weakness.) */
export function politicallyExposed(state: GameState): boolean {
  const sb = state.stateBlock
  const overdue = state.openLoops.filter((l) => !TERMINAL_LOOP_STATUSES.includes(l.status) && l.dueWeek < state.calendar.week).length
  return approvalMomentum(state) <= -3 || sb.whip <= -3 || sb.approval < 30 || overdue >= 2
}

/**
 * Which capital a summit centres on. Prefer the LIVE STORYLINE — a ripe
 * engagement the PM set in motion, else the capital their open loops are most
 * about — so a summit is the payoff of groundwork, never a jump to whoever's
 * most hostile. Falls back to the most hostile capital with a named leader only
 * when there is no foreign thread in play (e.g. a cold-open foreign crisis).
 * Deterministic; ties break by most-recently-touched, then declaration order.
 */
export function summitFocusCapital(state: GameState): string {
  // 1. A ripe engagement wins outright.
  const ripe = ripeSummitCapital(state)
  if (ripe) return ripe

  // 2. Otherwise, the capital the PM's live loops are most about.
  const engaged = state.foreignCapitals
    .map((c) => ({ c, n: loopsForCapital(state.openLoops, c).length }))
    .filter((x) => x.n > 0)
  if (engaged.length) {
    let pick = engaged[0]
    for (const e of engaged) {
      if (e.n > pick.n || (e.n === pick.n && e.c.lastUpdatedWeek > pick.c.lastUpdatedWeek)) pick = e
    }
    return pick.c.name
  }

  // 3. No storyline — the most hostile capital with a named leader (the old fallback).
  const withLeaders = state.foreignCapitals.filter((c) => CAPITAL_LEADERS[c.name])
  const pool = withLeaders.length ? withLeaders : state.foreignCapitals
  if (!pool.length) return ''
  let pick = pool[0]
  for (const c of pool) if (c.read < pick.read) pick = c
  return pick.name
}

// ---------------------------------------------------------------------------
// The scheduler
// ---------------------------------------------------------------------------

function isOpening(state: GameState): boolean {
  return !state.chosenAction.trim() && !state.options
}

/**
 * Resolve this week's kind. Priority (highest first):
 *   live encounter holds the floor → election night → crisis COBRA → event-driven
 *   COBRA/summit → (never back-to-back) autumn Budget → earned summit → earned
 *   PMQs → standard.
 *
 * Reads `state.pendingRolls.event` (already rolled this turn) to react to a
 * fresh security/foreign event, so must be called AFTER the event roll.
 */
export function scheduleTurnKind(state: GameState, _rng: Rng): TurnKind {
  // The establishing scene is always standard.
  if (isOpening(state)) return 'standard'

  // 0. A live encounter holds the floor: keep its kind until it resolves, so we
  //    never interrupt a summit or a 1:1 mid-conversation to reschedule.
  if (state.activeScene) return state.activeScene.kind

  // 1. Election night: the locals countdown has expired (and we haven't just held it).
  if (state.calendar.daysToLocals <= 0 && !recentlyHeld(state, 'election', 4)) return 'election'

  // 2. Crisis → COBRA when the threat board is hot.
  if (state.stateBlock.threat >= 4) return 'cobra'

  // 3. React to an event that fired THIS turn.
  const ev = state.pendingRolls?.event
  if (ev) {
    if (ev.category === 2) return 'cobra' // security / terror incident
    if (ev.category === 4) return 'summit' // foreign crisis → summit table
  }

  // 4. Earned set-pieces — never directly after another set-piece (no back-to-back).
  if (isSetpiece(state.turnKind)) return 'standard'

  // The Budget is the one fixed autumn fixture (a real constitutional event).
  if (budgetWindow(state.calendar.dateISO) && !recentlyHeld(state, 'budget', 20)) return 'budget'

  // A summit only fires when a foreign thread the PM built has ripened.
  if (state.foreignCapitals.length > 0 && ripeSummitCapital(state) && !recentlyHeld(state, 'summit', 3)) return 'summit'

  // PMQs only when the House would smell blood — and only while it's sitting.
  if (houseSitting(state.calendar.dateISO) && politicallyExposed(state) && !recentlyHeld(state, 'pmqs', 4)) return 'pmqs'

  return 'standard'
}
