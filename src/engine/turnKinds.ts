import type { TurnKind } from '../state/schema'

/**
 * The single source of truth about each turn-kind: how it reads in the UI,
 * whether it counts as a home or abroad set-piece (the cadence balancer reads
 * these tags), and whether the player may queue it themselves.
 *
 * Keeping this table in one place is what makes the domestic↔international
 * balance auditable and testable (US-204).
 */

export type SetpieceScope = 'domestic' | 'international'

export interface TurnKindMeta {
  /** Short chip label; empty for `standard` (no chip). */
  label: string
  /** Home vs abroad — null for `standard`. The balancer reads this. */
  scope: SetpieceScope | null
  /** Reactive set-pieces (crisis / fixed calendar) are exempt from the rolling
   *  balance guardrail — they fire when the world demands, not on cadence. */
  reactive: boolean
  /** May the player queue this from the "PM actions" sheet (US-106)? */
  playerInitiable: boolean
  /** Longer banner headline shown above the scene. */
  banner: string
  /** One-line "This week" description for the Dossier / actions sheet. */
  blurb: string
  /** How many beats this set-piece plays over. 1 = a single-turn set-piece
   *  (resolves at once, e.g. Budget/Reshuffle/Election via structured input);
   *  >1 = a clock-held encounter the PM lives through beat by beat. */
  beats: number
}

export const TURN_KIND_META: Record<TurnKind, TurnKindMeta> = {
  standard: { label: '', scope: null, reactive: false, playerInitiable: false, banner: '', blurb: 'An ordinary week in office.', beats: 1 },
  pmqs: {
    label: 'PMQs',
    scope: 'domestic',
    reactive: false,
    playerInitiable: false,
    banner: 'Prime Minister’s Questions',
    blurb: 'The despatch box. Trade blows across the floor of the House.',
    beats: 2,
  },
  budget: {
    label: 'Budget',
    scope: 'domestic',
    reactive: true,
    playerInitiable: true,
    banner: 'The Fiscal Event',
    blurb: 'Open the red box and allocate the headroom you have.',
    beats: 1,
  },
  cobra: {
    label: 'COBRA',
    scope: 'domestic',
    reactive: true,
    playerInitiable: true,
    banner: 'COBRA — Crisis Response',
    blurb: 'The room goes quiet. Hours, not weeks.',
    beats: 3,
  },
  summit: {
    label: 'Summit',
    scope: 'international',
    reactive: false,
    playerInitiable: true,
    banner: 'Summit',
    blurb: 'A leader across the table. Read them, and hold your posture.',
    beats: 3,
  },
  reshuffle: {
    label: 'Reshuffle',
    scope: 'domestic',
    reactive: true,
    playerInitiable: true,
    banner: 'Cabinet Reshuffle',
    blurb: 'Promote, move, and sack. Reshape your government.',
    beats: 1,
  },
  election: {
    label: 'Election',
    scope: 'domestic',
    reactive: true,
    playerInitiable: false,
    banner: 'Election Night',
    blurb: 'The results come in. The country delivers its verdict.',
    beats: 1,
  },
}

/** Is this a non-standard, set-piece week? */
export function isSetpiece(kind: TurnKind): boolean {
  return kind !== 'standard'
}

/** Does this kind play out as a clock-held, multi-beat encounter (vs. a single
 *  resolve-at-once turn)? Summit / COBRA / PMQs do; the rest don't. */
export function isMultiBeat(kind: TurnKind): boolean {
  return TURN_KIND_META[kind].beats > 1
}

/** Bounds for a live encounter's beat count (also clamps a narrator-proposed
 *  contextual 1:1 so it can never stall the premiership). */
export const MIN_ENCOUNTER_BEATS = 2
export const MAX_ENCOUNTER_BEATS = 4

/** The set-pieces the player may queue for next week, given current state. */
export function initiableTurnKinds(state: { cabinet: unknown[]; foreignCapitals: unknown[] }): TurnKind[] {
  const kinds = (Object.keys(TURN_KIND_META) as TurnKind[]).filter((k) => TURN_KIND_META[k].playerInitiable)
  return kinds.filter((k) => {
    if (k === 'reshuffle') return state.cabinet.length > 0
    if (k === 'summit') return state.foreignCapitals.length > 0
    return true
  })
}
