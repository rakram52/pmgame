import type { GameState, Ending } from '../state/schema'

/**
 * Code-owned end-state detection (US-503). The model never decides when the
 * premiership ends — this pure function does, from the numbers alone. Ordered so
 * a survived term is only awarded when the government is genuinely intact.
 */

/** Weeks in office that constitute seeing out the term (~two years of drama). */
export const TERM_END_WEEK = 104

export interface EndingMeta {
  won: boolean
  title: string
  blurb: string
}

export const ENDING_META: Record<Ending, EndingMeta> = {
  fallen: {
    won: false,
    title: 'The Government Falls',
    blurb: 'Authority drained away — the party and the country stopped listening. It is over.',
  },
  defeated: {
    won: false,
    title: 'Confidence Lost',
    blurb: 'The majority collapsed on the floor of the House. A confidence vote you could not win.',
  },
  survived: {
    won: true,
    title: 'The Term Survived',
    blurb: 'You saw it through. Battered, wiser, still standing at the despatch box.',
  },
  triumph: {
    won: true,
    title: 'A Premiership That Mattered',
    blurb: 'You did not merely survive — you governed, and left the office stronger than you found it.',
  },
}

/**
 * Resolve the terminal outcome, or null while the game is still live.
 * Monotone-ish: a healthier state never produces a worse ending.
 */
export function computeEnding(s: GameState): Ending | null {
  const { approval, capital, whip } = s.stateBlock

  // A full term seen out, with the government still standing, is the win.
  if (s.calendar.week >= TERM_END_WEEK && approval >= 15 && capital > 0 && whip > -15) {
    return approval >= 45 ? 'triumph' : 'survived'
  }

  // The majority evaporates — a confidence defeat.
  if (whip <= -15) return 'defeated'

  // The government falls: lost the party (capital) or the country (approval).
  if (capital <= 0 || approval < 15) return 'fallen'

  return null
}
