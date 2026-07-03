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
    `This week is a CABINET RESHUFFLE, driven by the PM's own instruction (the moves they named — promote / move / sack). Set the scene: the summonses to Number 10, the carrying-out of red boxes, the corridor rumours — and carry out exactly what the PM asked.
Frame the three options as how the PM handles the fallout (e.g. sell it as renewal / face down the snubbed / go quiet and let it settle), honestly risk-tagged.
Return a cabinet delta (update/remove/add) and adjust standings: the promoted rise, the snubbed and sacked fall (a sacking can start to plot). Append a one-line keyHistory recording the reshuffle's shape.`,

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

/**
 * The LIVE-ENCOUNTER block — the beat mechanics for any clock-held scene, whether
 * an engine-scheduled set-piece (summit / COBRA / PMQs) or a narrator-opened 1:1
 * on an ordinary week. It sits ON TOP of the set-piece voice above (if any) and
 * makes the pacing explicit: you are in the room, the clock is held, play ONE
 * exchange, do not jump to next week. Null when no encounter is live.
 */
export function encounterSection(s: GameState): string | null {
  const sc = s.activeScene
  if (!sc) return null
  const who = sc.focus ? ` with ${sc.focus}` : ''
  const head = `You are IN THE ROOM${who}. This is a LIVE, face-to-face encounter and the clock is HELD — one continuous moment, not a week. It is BEAT ${sc.beat} of up to ${sc.maxBeats}.`

  if (sc.beat < sc.maxBeats) {
    return `${head}
Do NOT resolve, summarise or wrap this up, and do NOT advance time or jump ahead. Play exactly ONE exchange: the PM's move lands, the other party answers IN CHARACTER — push back, bargain, probe, deflect, or raise the stakes — and the moment sharpens. Then offer three REGISTERS for how the PM carries the conversation forward (ways to play THIS exchange, not week-level policy), each honestly risk-tagged. Move only SMALL deltas this beat; hold the decisive swing and the keyHistory line until it resolves.
To keep the conversation going another beat, include "encounter": { "open": true } in the delta. If it reaches its natural end THIS beat instead, include "encounter": { "resolve": true }, settle it, and append one keyHistory line.`
  }

  return `${head}
This is the FINAL beat — bring it to a HEAD: the last exchange, who moved whom, the outcome and the fallout as the room breaks up. Apply the decisive delta now, append ONE keyHistory line, and include "encounter": { "resolve": true }. After this the week moves on.`
}
