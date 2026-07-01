import type { GameState, Risk } from '../state/schema'
import type { Rng } from './rng'

/**
 * Deterministic action resolution. Success is `d100 roll <= effectiveDifficulty`
 * (higher difficulty = easier). The base comes from the option's risk tag, which
 * the model declared BEFORE the player chose — so it can't be gamed toward a
 * desired outcome — then code-known modifiers (capital, difficulty bias) apply.
 * Margin drives the tier so the model can narrate degree (ironic failure, etc.).
 */

const RISK_BASE: Record<Risk, number> = {
  easy: 75,
  moderate: 55,
  hard: 40,
  desperate: 25,
}

const BIAS_MOD: Record<GameState['houseRules']['difficultyBias'], number> = {
  easy: 10,
  standard: 0,
  hard: -10,
}

export type ActionResult = NonNullable<GameState['pendingRolls']>['action']

export function computeDifficulty(state: GameState, risk: Risk): number {
  const base = RISK_BASE[risk]
  const capitalMod = Math.round((state.stateBlock.capital - 50) / 5)
  const biasMod = BIAS_MOD[state.houseRules.difficultyBias]
  return clamp(base + capitalMod + biasMod, 5, 95)
}

function tierFromMargin(margin: number): NonNullable<ActionResult>['tier'] {
  if (margin >= 30) return 'critical-success'
  if (margin >= 0) return 'success'
  if (margin >= -15) return 'partial'
  if (margin >= -40) return 'failure'
  return 'critical-failure'
}

export function resolveAction(rng: Rng, state: GameState, risk: Risk): NonNullable<ActionResult> {
  const roll = rng.d(100)
  const difficulty = computeDifficulty(state, risk)
  const margin = difficulty - roll
  return {
    roll,
    difficulty,
    success: roll <= difficulty,
    margin,
    tier: tierFromMargin(margin),
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
