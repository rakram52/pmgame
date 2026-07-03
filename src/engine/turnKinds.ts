import type { TurnKind } from '../state/schema'

/**
 * The single source of truth about each turn-kind: how it reads in the UI and
 * how it plays. Set-pieces are EARNED by the scheduler from state, not run on a
 * cadence, so there is no home↔abroad balancer to tag for any more — this table
 * is purely presentation + beat count.
 */

export interface TurnKindMeta {
  /** Short chip label; empty for `standard` (no chip). */
  label: string
  /** Longer banner headline shown above the scene. */
  banner: string
  /** One-line "This week" description for the Dossier. */
  blurb: string
  /** How many beats this set-piece plays over. 1 = a single-turn set-piece
   *  (resolves at once, e.g. Budget/Election via structured input or free text);
   *  >1 = a clock-held encounter the PM lives through beat by beat. */
  beats: number
}

export const TURN_KIND_META: Record<TurnKind, TurnKindMeta> = {
  standard: { label: '', banner: '', blurb: 'An ordinary week in office.', beats: 1 },
  pmqs: {
    label: 'PMQs',
    banner: 'Prime Minister’s Questions',
    blurb: 'The despatch box. Trade blows across the floor of the House.',
    beats: 2,
  },
  budget: {
    label: 'Budget',
    banner: 'The Fiscal Event',
    blurb: 'Open the red box and allocate the headroom you have.',
    beats: 1,
  },
  cobra: {
    label: 'COBRA',
    banner: 'COBRA — Crisis Response',
    blurb: 'The room goes quiet. Hours, not weeks.',
    beats: 3,
  },
  summit: {
    label: 'Summit',
    banner: 'Summit',
    blurb: 'A leader across the table. Read them, and hold your posture.',
    beats: 3,
  },
  reshuffle: {
    label: 'Reshuffle',
    banner: 'Cabinet Reshuffle',
    blurb: 'Promote, move, and sack. Reshape your government.',
    beats: 1,
  },
  election: {
    label: 'Election',
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
