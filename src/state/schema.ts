import { z } from 'zod'

/**
 * The canonical game state. This is the single source of truth — it lives in
 * code (IndexedDB), never in the language model's context. The model is only
 * ever handed a compact *snapshot* of this and asked to narrate + propose a
 * delta; code owns and validates everything here.
 */

export const SCHEMA_VERSION = 5

// ---------------------------------------------------------------------------
// Small enums / leaf schemas
// ---------------------------------------------------------------------------

export const FactionSchema = z.enum([
  'soft-left',
  'starmerite',
  'blue-labour',
  'independent',
  'official', // non-political civil servants / spooks
  'other',
])
export type Faction = z.infer<typeof FactionSchema>

export const TrendSchema = z.enum(['rising', 'falling', 'steady'])
export type Trend = z.infer<typeof TrendSchema>

/** Open-loop lifecycle (faithful to v15 wording). Terminal = delivered/resolved/failed. */
export const LoopStatusSchema = z.enum([
  'commissioned',
  'in-progress',
  'delivered',
  'stalled',
  'buried',
  'leaked',
  'resolved',
  'failed',
])
export type LoopStatus = z.infer<typeof LoopStatusSchema>

export const TERMINAL_LOOP_STATUSES: LoopStatus[] = ['delivered', 'resolved', 'failed']

export const StatusSchema = z.enum(['stable', 'wounded', 'lost'])
export type GameStatus = z.infer<typeof StatusSchema>

/** A terminal outcome for the premiership (US-503). Null while the game runs. */
export const EndingSchema = z.enum(['fallen', 'defeated', 'survived', 'triumph'])
export type Ending = z.infer<typeof EndingSchema>

/** The KIND of a given week, decided in code by the scheduler (never the model).
 *  `standard` is the ordinary read-a-scene / pick-an-option turn; the rest are
 *  set-pieces that read and play differently. */
export const TurnKindSchema = z.enum(['standard', 'pmqs', 'budget', 'cobra', 'summit', 'reshuffle', 'election'])
export type TurnKind = z.infer<typeof TurnKindSchema>

export const RiskSchema = z.enum(['easy', 'moderate', 'hard', 'desperate'])
export type Risk = z.infer<typeof RiskSchema>

// ---------------------------------------------------------------------------
// Records (every collection element carries a stable id)
// ---------------------------------------------------------------------------

export const CastMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  faction: FactionSchema.default('other'),
  agenda: z.string().default(''),
  /** -100 (hostile / plotting) .. +100 (utterly loyal), relative to the PM. */
  standing: z.number().default(0),
  notes: z.string().default(''),
})
export type CastMember = z.infer<typeof CastMemberSchema>

export const OpenLoopSchema = z.object({
  id: z.string(),
  who: z.string().default(''),
  title: z.string(),
  detail: z.string().default(''),
  commissionedWeek: z.number(),
  dueWeek: z.number(),
  status: LoopStatusSchema.default('commissioned'),
  resolutionNote: z.string().default(''),
})
export type OpenLoop = z.infer<typeof OpenLoopSchema>

export const StreamSchema = z.object({
  id: z.string(),
  name: z.string(),
  reading: z.string().default(''),
  trend: TrendSchema.default('steady'),
  lastUpdatedWeek: z.number().default(0),
})
export type Stream = z.infer<typeof StreamSchema>

export const ForeignCapitalSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** -100 (hostile) .. +100 (aligned). */
  read: z.number().default(0),
  posture: z.string().default(''),
  lastUpdatedWeek: z.number().default(0),
})
export type ForeignCapital = z.infer<typeof ForeignCapitalSchema>

/** Buried-but-live: a secret the ENGINE holds. Untriggered secrets are NEVER
 *  sent to the model, so it cannot leak them early. */
export const SecretSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string().default(''),
  exposureRisk: z.number().default(10), // 0..100, per-turn chance to surface
  triggered: z.boolean().default(false),
  plantedWeek: z.number().default(0),
})
export type Secret = z.infer<typeof SecretSchema>

export const KeyHistoryEntrySchema = z.object({
  week: z.number(),
  turnIndex: z.number(),
  summary: z.string(),
})
export type KeyHistoryEntry = z.infer<typeof KeyHistoryEntrySchema>

/** One row of the code-owned set-piece log — the memory the cadence balancer
 *  reads to keep home and abroad in balance and to tag timeline entries. */
export const SetpieceHistoryEntrySchema = z.object({
  week: z.number(),
  turnIndex: z.number(),
  kind: TurnKindSchema,
})
export type SetpieceHistoryEntry = z.infer<typeof SetpieceHistoryEntrySchema>

/** One append-only sample of the headline numbers, for sparklines and trends. */
export const StatSampleSchema = z.object({
  week: z.number(),
  turnIndex: z.number(),
  approval: z.number(),
  reform: z.number(),
  capital: z.number(),
  whip: z.number(),
  gilt: z.number(),
  gbp: z.number(),
  threat: z.number(),
})
export type StatSample = z.infer<typeof StatSampleSchema>

export const PendingConsequenceSchema = z.object({
  id: z.string(),
  source: z.string().default(''), // e.g. "doctrine:immigration:A"
  description: z.string(),
  triggerCondition: z.string().default(''),
  dueWeek: z.number().nullable().default(null),
  fired: z.boolean().default(false),
})
export type PendingConsequence = z.infer<typeof PendingConsequenceSchema>

export const CustomStatSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  min: z.number().default(0),
  max: z.number().default(100),
  suffix: z.string().default(''),
})
export type CustomStat = z.infer<typeof CustomStatSchema>

// ---------------------------------------------------------------------------
// Core numeric state block
// ---------------------------------------------------------------------------

export const StateBlockSchema = z.object({
  approval: z.number().default(38), // %
  reform: z.number().default(29), // Reform UK %
  gbp: z.number().default(1.19), // GBP/USD
  gilt: z.number().default(4.8), // 10y gilt yield %
  capital: z.number().default(55), // political capital, 0..100
  whip: z.number().default(3), // working majority / whip margin (can go negative)
  threat: z.number().default(3), // 1 LOW .. 5 CRITICAL (3 = SUBSTANTIAL)
  custom: z.array(CustomStatSchema).default([]),
})
export type StateBlock = z.infer<typeof StateBlockSchema>

export const THREAT_LABELS = ['LOW', 'MODERATE', 'SUBSTANTIAL', 'SEVERE', 'CRITICAL'] as const

// ---------------------------------------------------------------------------
// Doctrine (the 9 dials)
// ---------------------------------------------------------------------------

export const DOCTRINE_KEYS = [
  'immigration',
  'economy',
  'nhs',
  'costOfLiving',
  'crime',
  'housing',
  'atlanticEurope',
  'defence',
  'reformStrategy',
] as const
export type DoctrineKey = (typeof DOCTRINE_KEYS)[number]

export const DoctrineDialSchema = z.object({
  value: z.string(), // 'A' | 'B' | 'C' | custom label
  summary: z.string().default(''),
  /** The PM's own standing instruction for this policy area, set at government
   *  formation. Handed to the narrator verbatim so it steers how the dial plays
   *  out. Empty = follow the preset option only. */
  directive: z.string().default(''),
  lockedConsequenceId: z.string().nullable().default(null),
})
export type DoctrineDial = z.infer<typeof DoctrineDialSchema>

export const DoctrineSchema = z.object({
  immigration: DoctrineDialSchema,
  economy: DoctrineDialSchema,
  nhs: DoctrineDialSchema,
  costOfLiving: DoctrineDialSchema,
  crime: DoctrineDialSchema,
  housing: DoctrineDialSchema,
  atlanticEurope: DoctrineDialSchema,
  defence: DoctrineDialSchema,
  reformStrategy: DoctrineDialSchema,
})
export type Doctrine = z.infer<typeof DoctrineSchema>

// ---------------------------------------------------------------------------
// Calendar / RNG / house rules
// ---------------------------------------------------------------------------

export const CalendarSchema = z.object({
  week: z.number().default(1),
  dateISO: z.string().default('2026-04-13'),
  daysToLocals: z.number().default(24),
})
export type Calendar = z.infer<typeof CalendarSchema>

export const RngStateSchema = z.object({
  seed: z.string(),
  counter: z.number().default(0),
})
export type RngState = z.infer<typeof RngStateSchema>

export const HouseRulesSchema = z.object({
  voiceProfile: z.string().default('default'),
  difficultyBias: z.enum(['easy', 'standard', 'hard']).default('standard'),
  modelProfile: z.enum(['claude', 'chatgpt', 'other']).default('claude'),
  contentPrefs: z.string().default(''),
})
export type HouseRules = z.infer<typeof HouseRulesSchema>

// ---------------------------------------------------------------------------
// Live turn surface (the three current options + their pre-declared risks)
// ---------------------------------------------------------------------------

export const TurnOptionsSchema = z.object({
  A: z.string(),
  B: z.string(),
  C: z.string(),
})
export type TurnOptions = z.infer<typeof TurnOptionsSchema>

export const OptionRisksSchema = z.object({
  A: RiskSchema.default('moderate'),
  B: RiskSchema.default('moderate'),
  C: RiskSchema.default('moderate'),
})
export type OptionRisks = z.infer<typeof OptionRisksSchema>

/** Dice pre-rolled by the engine for the turn being resolved. Honest, seeded,
 *  reproducible. The model narrates these; it never rolls. */
export const PendingRollsSchema = z.object({
  action: z
    .object({
      roll: z.number(),
      difficulty: z.number(),
      success: z.boolean(),
      margin: z.number(),
      tier: z.enum(['critical-success', 'success', 'partial', 'failure', 'critical-failure']),
    })
    .nullable()
    .default(null),
  worldVariance: z.object({ roll: z.number(), label: z.string(), directive: z.string() }).nullable().default(null),
  event: z.object({ roll: z.number(), category: z.number(), title: z.string(), directive: z.string() }).nullable().default(null),
})
export type PendingRolls = z.infer<typeof PendingRollsSchema>

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export const GameStateSchema = z.object({
  schemaVersion: z.number().default(SCHEMA_VERSION),
  gameId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  pmName: z.string().default('Prime Minister'),

  turnIndex: z.number().default(1),
  phase: z.enum(['setup', 'play']).default('setup'),

  /** What KIND of week this is — resolved in code by the scheduler each turn. */
  turnKind: TurnKindSchema.default('standard'),
  /** A player-requested set-piece for the NEXT turn (agency between forced
   *  decisions). Consumed and cleared by the reducer once the turn commits. */
  queuedTurnKind: TurnKindSchema.nullable().default(null),
  /** Code-owned log of the set-pieces that have fired, capped, for the balancer. */
  setpieceHistory: z.array(SetpieceHistoryEntrySchema).default([]),
  /** Small human label a set-piece needs surfaced (e.g. the summit's capital),
   *  set by the scheduler so the prompt and the banner agree. */
  setpieceContext: z.string().default(''),

  rng: RngStateSchema,
  calendar: CalendarSchema,
  doctrine: DoctrineSchema,
  stateBlock: StateBlockSchema,

  cabinet: z.array(CastMemberSchema).default([]),
  standingCast: z.array(CastMemberSchema).default([]),

  openLoops: z.array(OpenLoopSchema).default([]),
  streams: z.array(StreamSchema).default([]),
  foreignCapitals: z.array(ForeignCapitalSchema).default([]),
  buriedButLive: z.array(SecretSchema).default([]),
  keyHistory: z.array(KeyHistoryEntrySchema).default([]),
  /** Append-only, capped trail of the headline numbers for sparklines/trends. */
  statHistory: z.array(StatSampleSchema).default([]),
  pendingConsequences: z.array(PendingConsequenceSchema).default([]),

  worldVariance: z
    .object({ openingRoll: z.number(), openingLabel: z.string() })
    .default({ openingRoll: 6, openingLabel: 'baseline' }),
  lastEventCategory: z.number().nullable().default(null),

  narrativeSummary: z.string().default(''),
  houseRules: HouseRulesSchema,

  /** Monotonic counter for deterministic record ids (keeps replays identical). */
  idCounter: z.number().default(0),

  // live turn surface
  currentScene: z.string().default(''),
  options: TurnOptionsSchema.nullable().default(null),
  optionRisks: OptionRisksSchema.nullable().default(null),
  pendingRolls: PendingRollsSchema.nullable().default(null),
  pendingInjections: z.array(z.string()).default([]),
  chosenAction: z.string().default(''),
  chosenRisk: RiskSchema.nullable().default(null),
  /** The decision/instruction that produced the CURRENT scene, kept so the app
   *  can echo "your move" back to the player (chosenAction is cleared on commit). */
  lastAction: z.string().default(''),
  lastPrompt: z.string().default(''),
  lastRawReply: z.string().default(''),
  status: StatusSchema.default('stable'),
  /** Terminal outcome, code-owned and sticky once set (null while the game runs). */
  ending: EndingSchema.nullable().default(null),
})
export type GameState = z.infer<typeof GameStateSchema>
