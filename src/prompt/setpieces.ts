import type { GameState, TurnKind } from '../state/schema'
import { CAPITAL_LEADERS } from '../game/links'

/**
 * Per-turn-kind instruction modules. Each block layers ON TOP of RULES_CORE and
 * is compatible with BOTH output contracts (it only shapes the scene + the three
 * options + which delta rows to touch — never the transport). The engine has
 * already decided the kind; this only tells the narrator how the week reads.
 *
 * `standard` has no block, so standard prompts remain byte-identical to today.
 */

const BLOCKS: Record<Exclude<TurnKind, 'standard'>, (s: GameState) => string> = {
  pmqs: () =>
    `This week is PRIME MINISTER'S QUESTIONS. Stage the noon clash in the Commons: the Leader of the Opposition (and/or the Reform leader) lands one or two sharp, specific attacks tied to the live state — a bad number, a due open loop, a stumbling doctrine. Backbenches roar; the Speaker calls order. Keep it to the chamber.
Frame the three options as REGISTERS the PM can adopt at the despatch box, each honestly risk-tagged:
  A — ATTACK BACK: go for the jugular, turn the question on the questioner (higher variance).
  B — DEFUSE WITH DATA: sober, statistic-led, deny them the clip (safer, rarely a win).
  C — PIVOT TO YOUR RECORD: change the subject to your strongest ground (moderate).
Delta should move some of: approval, capital, whip (a strong showing steadies the benches; a mauling costs you). Append a one-line keyHistory recording who won the exchange.`,

  summit: (s) => {
    const capital = s.setpieceContext || (s.foreignCapitals[0]?.name ?? 'a foreign capital')
    const leader = CAPITAL_LEADERS[capital]
    const who = leader ? `${leader} (${capital})` : capital
    return `This week is a FOREIGN SUMMIT / BILATERAL with ${who}. Run it through the realist engine: a rational egoist across the table, survival and relative power first. ${leader ? `${leader} walks on in character.` : 'The leader walks on in character.'} The room is the scene — read, feint, pressure.
Frame the three options as POSTURES, each honestly risk-tagged:
  A — CONCEDE TO HOLD THE ALLIANCE: pay now to keep the relationship (costs capital, steadies the read).
  B — HEDGE: give nothing decisive, keep options open (moderate, ambiguous outcome).
  C — CALL THE BLUFF: refuse, dare them to follow through (high variance; can win big or blow up).
Delta primarily moves foreignCapitals[] (readDelta + posture) for ${capital}; it may also touch threat and capital. Append a one-line keyHistory recording the summit's upshot.`
  },

  cobra: (s) => {
    const label = s.setpieceContext && s.setpieceContext !== 'Security' ? s.setpieceContext : 'a fast-moving security crisis'
    return `This week is a COBRA CRISIS — ${label}. Collapse the clock to HOURS, not weeks: timestamps, a room going quiet, officials clipped and hedged, decisions with no clean option. If the crisis is intraday, set calendar.advanceWeeks to 0 (the same day continues).
Raise the stakes and tag the options accordingly — most should be hard or desperate:
  A / B / C — genuine crisis responses (e.g. hard security action / contain and manage / a desperate gambit), each risk-tagged honestly.
Delta can move threat, approval, capital and cabinet standings (a minister may crack or shine). Append a one-line keyHistory recording the decision taken under pressure.`
  },

  budget: (s) => {
    const econ = s.doctrine.economy?.summary || s.doctrine.economy?.value || 'the fiscal doctrine'
    return `This week is the BUDGET / FISCAL EVENT. Set the scene around the red box: the Chancellor, the OBR, the markets watching, the backdrop of ${econ}. The APP will present the PM with a structured allocation interface, so the PM's decision will arrive as a detailed spending package (a list of departments/levers and amounts) rather than a single sentence.
Still provide three options as broad fallback stances (e.g. protect services / hold the line / a growth gamble), honestly risk-tagged — but expect the real decision to be the allocation.
When you later narrate the reaction, move gilt, gbp, approval, capital and any relevant streams in line with the package and any FISCAL ENGINE note provided. Append a one-line keyHistory recording the Budget's headline.`
  },

  reshuffle: () =>
    `This week is a CABINET RESHUFFLE. Set the scene: the summonses to Number 10, the carrying-out of red boxes, the corridor rumours. The APP will present the PM with a structured personnel interface, so the PM's decision will arrive as a list of moves (promote / move / sack, with names) rather than a single sentence.
Still provide three options as broad fallback framings (e.g. a loyalist consolidation / a balancing act / a ruthless clear-out), honestly risk-tagged — but expect the real decision to be the moves.
When you narrate the fallout, return a cabinet delta (update/remove/add) and adjust standings: the promoted rise, the snubbed and sacked fall (a sacking can start to plot). Append a one-line keyHistory recording the reshuffle's shape.`,

  election: () =>
    `This week is ELECTION NIGHT (the local elections). The engine has already computed the result and handed it to you in an ELECTION RESULT directive above — narrate THOSE numbers faithfully; do not invent a different result. Stage a single election-night scene: the results desk, a defining hold or loss, the reaction on the benches and in the leader's office.
Frame the three options as how the PM PLAYS the result publicly, honestly risk-tagged:
  A — OWN IT / DEFIANCE, B — CONTRITION / RESET, C — DEFLECT / BLAME THE WEATHER (each with its own risk).
Apply the exact stateBlock delta from the ELECTION RESULT directive. Append a one-line keyHistory recording the verdict.`,
}

/** The set-piece instruction block for this week, or null for a standard turn. */
export function setpieceSection(s: GameState): string | null {
  if (s.turnKind === 'standard') return null
  return BLOCKS[s.turnKind](s)
}
