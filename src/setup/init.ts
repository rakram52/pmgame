import type { GameState, CastMember, DoctrineKey, PendingConsequence, ForeignCapital, Stream, DoctrineDial } from '../state/schema'
import { GameStateSchema, DOCTRINE_KEYS } from '../state/schema'
import { Rng, freshSeed } from '../engine/rng'
import { GREAT_OFFICES, INNER_MACHINE, SECOND_TIER_THEMES, DOCTRINE_DIALS } from './content'

export interface SetupSelections {
  pmName: string
  /** role key -> candidate name */
  offices: Record<string, string>
  innerMachine: Record<string, string>
  secondTierTheme: string
  /** doctrine dial key -> option key ('A' | 'B' | 'C') */
  doctrine: Record<string, string>
  difficultyBias?: 'easy' | 'standard' | 'hard'
  modelProfile?: 'claude' | 'chatgpt' | 'other'
}

const OPENING_VARIANCE = [
  'Iran ceasefire collapses by Week 2',
  'sterling crisis already underway',
  'Trump–Putin summit announced',
  'terror plot disrupted on Day 1',
  'royal scandal breaks',
  'baseline',
]

export function initGameState(sel: SetupSelections, seedOverride?: string): GameState {
  const seed = seedOverride ?? freshSeed()
  const rng = new Rng(seed, 0)

  let idn = 0
  const nid = (p: string) => `${p}${idn++}`

  // --- Cabinet (great offices + inner machine that sit in Cabinet) ---
  const cabinet: CastMember[] = []
  const standingCast: CastMember[] = []

  for (const office of GREAT_OFFICES) {
    const name = sel.offices[office.key]
    const c = office.candidates.find((x) => x.name === name)
    cabinet.push({ id: nid('cab'), name: name || office.candidates[0].name, role: office.role, faction: c?.faction ?? 'other', agenda: c?.agenda ?? '', standing: 15, notes: c?.blurb ?? '' })
  }

  for (const office of INNER_MACHINE) {
    const name = sel.innerMachine[office.key]
    const c = office.candidates.find((x) => x.name === name)
    const target = office.key === 'whip' || office.key === 'cabinetOffice' ? cabinet : standingCast
    target.push({ id: nid('cab'), name: name || office.candidates[0].name, role: office.role, faction: c?.faction ?? 'other', agenda: c?.agenda ?? '', standing: 20, notes: c?.blurb ?? '' })
  }

  // Second-tier by theme
  const theme = SECOND_TIER_THEMES.find((t) => t.key === sel.secondTierTheme) ?? SECOND_TIER_THEMES[1]
  for (const m of theme.ministers) {
    cabinet.push({ id: nid('cab'), name: m.name, role: `Secretary of State for ${m.role}`, faction: m.faction, agenda: '', standing: 10, notes: '' })
  }

  // Permanent officials
  standingCast.push({ id: nid('cab'), name: 'Sir Edmund Hartley', role: 'Cabinet Secretary', faction: 'official', agenda: 'Protect the machine and the constitution.', standing: 0, notes: 'Runs the Civil Service; institutionally cautious.' })
  standingCast.push({ id: nid('cab'), name: 'Sir Marcus Bell', role: '"C" — Chief of SIS', faction: 'official', agenda: 'Guard sources; tell the PM only what serves the service.', standing: 0, notes: '' })

  // --- Doctrine + locked consequences ---
  const doctrine: Record<string, DoctrineDial> = {}
  const pendingConsequences: PendingConsequence[] = []
  for (const dial of DOCTRINE_DIALS) {
    const chosenKey = sel.doctrine[dial.key] ?? 'B'
    const opt = dial.options.find((o) => o.key === chosenKey) ?? dial.options[1]
    const consId = nid('cons')
    const dueWeek = rng.int(1, 10)
    pendingConsequences.push({ id: consId, source: `doctrine:${dial.key}:${chosenKey}`, description: opt.consequence, triggerCondition: `by week ${dueWeek}`, dueWeek, fired: false })
    doctrine[dial.key] = { value: chosenKey, summary: opt.label, lockedConsequenceId: consId }
  }

  // --- Opening world variance (d6) ---
  const vRoll = rng.d(6)
  const openingLabel = OPENING_VARIANCE[vRoll - 1]

  // --- Streams (starting arcs) ---
  const streams: Stream[] = [
    { id: nid('stream'), name: 'Iran energy shock', reading: 'Bills frozen to July; summer cliff-edge looming.', trend: 'rising', lastUpdatedWeek: 1 },
    { id: nid('stream'), name: 'NHS pay dispute', reading: 'Strikes rolling; no settlement.', trend: 'steady', lastUpdatedWeek: 1 },
    { id: nid('stream'), name: 'Prison capacity', reading: 'At operational capacity; s.114 pressure.', trend: 'rising', lastUpdatedWeek: 1 },
    { id: nid('stream'), name: 'Reform polling', reading: 'Leading nationally, ~29% and climbing.', trend: 'rising', lastUpdatedWeek: 1 },
    { id: nid('stream'), name: 'Local elections', reading: '7 May — English councils, London, Senedd, Holyrood.', trend: 'steady', lastUpdatedWeek: 1 },
  ]

  // --- Foreign capitals ---
  const foreignCapitals: ForeignCapital[] = [
    { id: nid('cap'), name: 'Washington', read: -25, posture: 'Transactional, tariff-happy, musing on NATO exit.', lastUpdatedWeek: 1 },
    { id: nid('cap'), name: 'Paris', read: 10, posture: 'Macron weakened but courting a European pillar.', lastUpdatedWeek: 1 },
    { id: nid('cap'), name: 'Berlin', read: 15, posture: 'Merz assertive; open to deeper defence ties.', lastUpdatedWeek: 1 },
    { id: nid('cap'), name: 'Brussels', read: 20, posture: 'Cautiously warming; customs-union talk in the air.', lastUpdatedWeek: 1 },
    { id: nid('cap'), name: 'Beijing', read: 0, posture: 'Flooding markets with cheap kit; a No.10 visit pending.', lastUpdatedWeek: 1 },
    { id: nid('cap'), name: 'Moscow', read: -40, posture: 'Frozen front; active North Sea grey-zone.', lastUpdatedWeek: 1 },
  ]

  const draft: GameState = {
    schemaVersion: 1,
    gameId: cryptoId(),
    createdAt: '',
    updatedAt: '',
    pmName: sel.pmName?.trim() || 'Prime Minister',
    turnIndex: 1,
    phase: 'play',
    rng: { seed, counter: rng.counter },
    calendar: { week: 1, dateISO: '2026-04-13', daysToLocals: 24 },
    doctrine: doctrine as GameState['doctrine'],
    stateBlock: { approval: 38, reform: 29, gbp: 1.19, gilt: 4.8, capital: 55, whip: 3, threat: 3, custom: [] },
    cabinet,
    standingCast,
    openLoops: [],
    streams,
    foreignCapitals,
    buriedButLive: [
      { id: nid('secret'), title: 'Defence brief indiscretion', detail: 'A minister was franker than they should have been on a hot mic during the Iran crisis. A recording exists.', exposureRisk: 8, triggered: false, plantedWeek: 1 },
    ],
    keyHistory: [{ week: 1, turnIndex: 1, summary: `Government formed. Doctrine locked. Opening posture: ${openingLabel}.` }],
    pendingConsequences,
    worldVariance: { openingRoll: vRoll, openingLabel },
    lastEventCategory: null,
    narrativeSummary: `Week 1: a new government takes office; 24 days to the 7 May locals with Reform leading and the Iran energy shock live. Opening tilt: ${openingLabel}.`,
    houseRules: { voiceProfile: 'default', difficultyBias: sel.difficultyBias ?? 'standard', modelProfile: sel.modelProfile ?? 'claude', contentPrefs: '' },
    idCounter: idn,
    currentScene: '',
    options: null,
    optionRisks: null,
    pendingRolls: null,
    pendingInjections: [],
    chosenAction: '',
    chosenRisk: null,
    lastPrompt: '',
    lastRawReply: '',
    status: 'stable',
  }

  // Validate through the schema so we never start from a malformed state.
  return GameStateSchema.parse(draft)
}

function cryptoId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'game-' + Math.random().toString(16).slice(2)
  }
}

/** Exhaustiveness helper — ensures every doctrine key has content. */
export function allDoctrineKeysCovered(): DoctrineKey[] {
  return [...DOCTRINE_KEYS]
}
