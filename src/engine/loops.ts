import type { OpenLoop } from '../state/schema'
import { TERMINAL_LOOP_STATUSES } from '../state/schema'

/**
 * Open loops with teeth (US — "loops decay if ignored"). A tasking the PM
 * commissions and then leaves to rot doesn't sit politely on a list forever: it
 * SLIPS (stalls, officials chasing), and if still neglected it LAPSES for good
 * (the chance gone, the ally snubbed, the initiative dead). This is the drift-
 * proof, code-owned half — the transitions and the fallout directives are decided
 * HERE, deterministically, so neglect always carries a real, narrated cost.
 *
 * Pure: no Date.now / randomness. Called once per (non-encounter) turn, past the
 * settling-in window, from prepareTurn.
 */

/** Weeks past a loop's deadline before it starts to stall. */
export const LOOP_STALL_AFTER = 2
/** Weeks past its deadline before a neglected loop collapses for good. */
export const LOOP_LAPSE_AFTER = 4
/** How far ahead (weeks) a loop is "coming due soon" and worth foreshadowing. */
export const LOOP_SOON_WINDOW = 2

// Only tasks actually AWAITING delivery can slip; a `buried`/`leaked` loop is a
// deliberate outcome, not neglected work, so it never decays.
const STALLABLE = new Set(['commissioned', 'in-progress'])
const LAPSABLE = new Set(['commissioned', 'in-progress', 'stalled'])

function ownerTag(l: OpenLoop): string {
  return l.who ? ` (${l.who})` : ''
}

/**
 * Advance neglect on the open loops for the given week. Returns the (possibly
 * updated) loops plus any engine directives the narrator must weave in this turn.
 * Transitions are one-shot — a loop stalls once and lapses once — so nothing
 * re-fires while it sits in the same degraded state.
 */
export function decayOpenLoops(loops: OpenLoop[], week: number): { loops: OpenLoop[]; injections: string[] } {
  const injections: string[] = []
  const next = loops.map((l) => {
    if (TERMINAL_LOOP_STATUSES.includes(l.status)) return l
    const overdue = week - l.dueWeek
    if (overdue < LOOP_STALL_AFTER) return l

    if (overdue >= LOOP_LAPSE_AFTER && LAPSABLE.has(l.status)) {
      injections.push(
        `A TASKING HAS LAPSED — "${l.title}"${ownerTag(l)} was left unattended ${overdue} weeks past its deadline and has now collapsed. Narrate the real cost of the neglect (a chance gone, an ally snubbed, an initiative dead), then close it out.`,
      )
      return { ...l, status: 'failed' as const, resolutionNote: l.resolutionNote || `Lapsed — neglected ${overdue}w past due.` }
    }

    if (STALLABLE.has(l.status)) {
      injections.push(
        `A TASKING IS SLIPPING — "${l.title}"${ownerTag(l)} has drifted ${overdue} weeks past its deadline with nothing delivered. Show it starting to fray: officials chasing, the PM's grip in question. It will lapse for good if still ignored.`,
      )
      return { ...l, status: 'stalled' as const }
    }

    return l
  })
  return { loops: next, injections }
}

/** Live loops approaching their deadline (due within the next few weeks but not
 *  yet due) — the ones the narrator should FORESHADOW so nothing lands cold. */
export function loopsComingDueSoon(loops: OpenLoop[], week: number): OpenLoop[] {
  return loops.filter(
    (l) => !TERMINAL_LOOP_STATUSES.includes(l.status) && l.dueWeek > week && l.dueWeek - week <= LOOP_SOON_WINDOW,
  )
}
