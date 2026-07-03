import type { GameState } from '../state/schema'
import { houseSitting, monthOf, politicallyExposed, ripeSummitCapital } from './schedule'
import { loopsComingDueSoon } from './loops'

/**
 * The horizon — a deterministic, code-owned read of what is BUILDING, so the PM
 * never flies blind into the next turn (and the narrator can foreshadow it). This
 * is a heads-up, not a promise: set-pieces are earned and the world is stochastic,
 * so items describe pressure ("a crisis could break", "a summit is on the table"),
 * not guaranteed events. Ordered most-pressing first and capped.
 */

export interface ForecastItem {
  kind: 'election' | 'budget' | 'summit' | 'pmqs' | 'cobra' | 'loop'
  text: string
}

const MAX_ITEMS = 4

export function forecast(state: GameState): ForecastItem[] {
  const items: ForecastItem[] = []
  const { calendar, stateBlock } = state
  const inSummit = state.turnKind === 'summit' || state.activeScene?.kind === 'summit'

  // A real fixed date: the locals countdown.
  const weeksToLocals = Math.ceil(calendar.daysToLocals / 7)
  if (calendar.daysToLocals > 0 && weeksToLocals <= 12) {
    items.push({ kind: 'election', text: `Local elections in ~${weeksToLocals} week${weeksToLocals === 1 ? '' : 's'} — the countdown is on.` })
  }

  // Crisis pressure on the threat board.
  if (stateBlock.threat >= 4) items.push({ kind: 'cobra', text: 'The threat board is hot — a crisis could force COBRA at any moment.' })
  else if (stateBlock.threat >= 3) items.push({ kind: 'cobra', text: 'Threat is elevated — a security or foreign shock could break.' })

  // A foreign thread the PM built, ripening into a summit.
  const ripe = ripeSummitCapital(state)
  if (ripe && !inSummit) items.push({ kind: 'summit', text: `Groundwork with ${ripe} has ripened — a summit is on the table.` })

  // The House smelling blood while the PM looks weak.
  if (houseSitting(calendar.dateISO) && politicallyExposed(state)) {
    items.push({ kind: 'pmqs', text: 'The benches are restless — a bruising PMQs looms while you look exposed.' })
  }

  // The autumn Budget coming into view (it fires in November).
  if (monthOf(calendar.dateISO) === 10) items.push({ kind: 'budget', text: 'The autumn Budget is weeks away — the Chancellor will want your numbers.' })

  // Loops about to bite: something already slipping, then anything due soon.
  const slipping = state.openLoops.find((l) => l.status === 'stalled')
  if (slipping) items.push({ kind: 'loop', text: `“${slipping.title}” is slipping — deliver it or lose it.` })
  for (const l of loopsComingDueSoon(state.openLoops, calendar.week)) {
    items.push({ kind: 'loop', text: `“${l.title}” comes due W${l.dueWeek}.` })
  }

  return items.slice(0, MAX_ITEMS)
}
