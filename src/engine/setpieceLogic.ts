import type { GameState } from '../state/schema'
import { clamp } from './resolve'

/**
 * Code-owned set-piece maths. These are the numbers the ENGINE decides — the
 * election result and the fiscal headroom — kept out of the model's hands so the
 * game stays drift-proof. Pure and deterministic; unit-tested for monotonicity.
 */

// ---------------------------------------------------------------------------
// Election night (US-501)
// ---------------------------------------------------------------------------

/** Recent approval momentum from the stat history: the mean of the last few
 *  turn-on-turn moves, clamped. Zero when there isn't enough history yet. */
export function approvalMomentum(state: GameState): number {
  const h = state.statHistory
  if (h.length < 2) return 0
  const tail = h.slice(-4)
  let sum = 0
  for (let i = 1; i < tail.length; i++) sum += tail[i].approval - tail[i - 1].approval
  return clamp(sum / (tail.length - 1), -6, 6)
}

export type ElectionTier = 'triumph' | 'solid' | 'setback' | 'rout'

export interface ElectionResult {
  /** Net electoral score (monotone increasing in approval & momentum). */
  score: number
  /** Net council seats vs the government (+ gains, − losses). */
  seatsSwing: number
  /** Vote-share swing in points (+ toward the government). */
  voteShareSwing: number
  tier: ElectionTier
  /** Code-owned state move fed through the normal delta path. */
  stateDelta: { approval: number; capital: number; whip: number }
  /** The engine directive the model must narrate faithfully. */
  injection: string
}

const ELECTION_TIERS: { min: number; tier: ElectionTier; verdict: string }[] = [
  { min: 8, tier: 'triumph', verdict: 'a striking win — the party gains ground and the doubters go quiet' },
  { min: 0, tier: 'solid', verdict: 'a night that holds up — losses contained, the story survivable' },
  { min: -8, tier: 'setback', verdict: 'a bad night — real losses, the benches rattled' },
  { min: -Infinity, tier: 'rout', verdict: 'a rout — councils fall, the leadership question is now open' },
]

/** Compute the election result from state. Monotone in approval: a higher
 *  approval never produces a worse night. */
export function computeElectionResult(state: GameState): ElectionResult {
  const { approval, reform } = state.stateBlock
  const momentum = approvalMomentum(state)
  const score = approval - 36 - 0.5 * (reform - 29) + momentum

  const row = ELECTION_TIERS.find((t) => score >= t.min)!
  const seatsSwing = Math.round(score * 6)
  const voteShareSwing = Math.round(score * 0.6 * 10) / 10

  // Deltas scale with the score, all monotone increasing in approval.
  const stateDelta = {
    approval: clamp(Math.round(score / 4), -6, 6),
    capital: clamp(Math.round(score / 2), -12, 12),
    whip: clamp(Math.round(score / 5), -6, 6),
  }

  const seatsPhrase = seatsSwing >= 0 ? `net +${seatsSwing} councillors` : `${seatsSwing} councillors`
  const votePhrase = voteShareSwing >= 0 ? `+${voteShareSwing}pt` : `${voteShareSwing}pt`
  const injection =
    `ELECTION RESULT (engine-computed — narrate faithfully, do not invent different numbers): ` +
    `${row.verdict}. Local elections: ${seatsPhrase}, vote-share swing ${votePhrase} vs the government. ` +
    `Apply this exact stateBlock delta: approval ${signed(stateDelta.approval)}, capital ${signed(stateDelta.capital)}, whip ${signed(stateDelta.whip)}. ` +
    `Stage a single election-night scene (results desk, a defining hold or loss, the leader's reaction) and offer three registers for how the PM plays the result.`

  return { score, seatsSwing, voteShareSwing, tier: row.tier, stateDelta, injection }
}

// ---------------------------------------------------------------------------
// The Budget / fiscal event (US-201)
// ---------------------------------------------------------------------------

/** Fiscal headroom in £bn, derived in code from gilt yield + the economy
 *  doctrine. Tighter markets (higher gilt) shrink it; a looser fiscal doctrine
 *  (growth reflation) widens the nominal envelope the PM can play with. */
export function computeHeadroom(state: GameState): number {
  const gilt = state.stateBlock.gilt
  const econ = state.doctrine.economy?.value ?? 'B'
  const doctrineAdj = econ === 'A' ? 4 : econ === 'C' ? 16 : 8 // iron / pragmatic / reflation
  const base = 28
  const giltPenalty = (gilt - 4.5) * 6
  return Math.round(clamp(base + doctrineAdj - giltPenalty, 4, 60))
}

export interface BudgetAssessment {
  headroom: number
  committed: number
  /** committed / headroom; >1 over-committed, <0.6 timidly under-committed. */
  ratio: number
  overcommitted: boolean
  undercommitted: boolean
  injection: string
}

/** Assess an allocation against the headroom. Over-committing surfaces a bigger
 *  gilt/sterling reaction; under-committing buys credibility but disappoints. */
export function assessBudget(headroom: number, committed: number): BudgetAssessment {
  const ratio = headroom > 0 ? committed / headroom : committed > 0 ? 2 : 0
  const overcommitted = committed > headroom + 0.5
  const undercommitted = committed < headroom * 0.6
  const over = Math.max(0, committed - headroom)

  let injection: string
  if (overcommitted) {
    injection =
      `FISCAL ENGINE: the package commits £${committed}bn against £${headroom}bn of headroom — over by £${over}bn. ` +
      `Markets react: push gilt UP and sterling DOWN more than usual, and let the OBR / lobby brief against the sums. ` +
      `Frame the political upside as real but bought on credit.`
  } else if (undercommitted) {
    injection =
      `FISCAL ENGINE: the package commits only £${committed}bn of £${headroom}bn of headroom — a cautious, credible book. ` +
      `Markets are reassured (gilt steady or easing) but allies and the base are underwhelmed; expect "timid" briefing.`
  } else {
    injection =
      `FISCAL ENGINE: the package commits £${committed}bn against £${headroom}bn of headroom — broadly within the envelope. ` +
      `Markets take it in stride; the politics turn on where the money went.`
  }
  return { headroom, committed, ratio, overcommitted, undercommitted, injection }
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : String(n)
}
