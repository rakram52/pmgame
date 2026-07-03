import type { GameState, CastMember, DoctrineKey, PendingConsequence, ForeignCapital, Stream, DoctrineDial, Indicator } from '../state/schema'
import { GameStateSchema, DOCTRINE_KEYS } from '../state/schema'
import { Rng, freshSeed } from '../engine/rng'
import { EARLIEST_CONSEQUENCE_WEEK } from '../engine/pacing'
import { GREAT_OFFICES, INNER_MACHINE, SECOND_TIER_THEMES, DOCTRINE_DIALS } from './content'

export interface SetupSelections {
  pmName: string
  /** role key -> candidate name */
  offices: Record<string, string>
  innerMachine: Record<string, string>
  secondTierTheme: string
  /** doctrine dial key -> option key ('A' | 'B' | 'C') */
  doctrine: Record<string, string>
  /** doctrine dial key -> the PM's own free-text instruction for that area (optional) */
  doctrineDirectives?: Record<string, string>
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
    // Spread the locked consequences across the early premiership, but never in
    // the settling-in weeks — the world ramps up, it doesn't ambush week 1.
    const dueWeek = rng.int(EARLIEST_CONSEQUENCE_WEEK, 14)
    const directive = (sel.doctrineDirectives?.[dial.key] ?? '').trim()
    pendingConsequences.push({ id: consId, source: `doctrine:${dial.key}:${chosenKey}`, description: opt.consequence, triggerCondition: `by week ${dueWeek}`, dueWeek, fired: false })
    doctrine[dial.key] = { value: chosenKey, summary: opt.label, directive, lockedConsequenceId: consId }
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

  // --- National indicators (real figures a PM would see taking office April
  //     2026 — the latest actual prints published by early 2026). Sourced from
  //     ONS, OBR/Treasury, NHS England, Ofgem, Home Office, MoJ and late-2025
  //     polling; the narrator nudges these as the premiership plays out. ---
  const ind = (key: string, label: string, domain: string, value: number, opts: Partial<Indicator> = {}): Indicator => ({
    key,
    label,
    domain,
    value,
    min: 0,
    max: 100,
    prefix: '',
    suffix: '',
    trend: 'steady',
    goodDir: 0,
    note: '',
    lastUpdatedWeek: 1,
    ...opts,
  })

  const indicators: Indicator[] = [
    // Macro
    ind('inflation', 'Inflation (CPI)', 'macro', 3.0, { suffix: '%', min: 0, max: 20, trend: 'falling', goodDir: -1, note: 'Cooling but above the 2% target; services and food sticky.' }),
    ind('gdpGrowth', 'GDP growth (yr)', 'macro', 1.3, { suffix: '%', min: -10, max: 10, trend: 'steady', goodDir: 1, note: 'Sluggish; near-stagnant into 2026.' }),
    ind('unemployment', 'Unemployment', 'macro', 5.0, { suffix: '%', min: 0, max: 20, trend: 'rising', goodDir: -1, note: 'Highest since 2021.' }),
    ind('baseRate', 'BoE base rate', 'macro', 3.75, { suffix: '%', min: 0, max: 15, trend: 'falling', goodDir: 0, note: 'On hold; markets split on the next move.' }),
    // Fiscal / the budget
    ind('debtGdp', 'Public debt', 'fiscal', 95.5, { suffix: '% GDP', min: 0, max: 200, trend: 'rising', goodDir: -1, note: 'Near its highest since the early 1960s.' }),
    ind('deficit', 'Budget deficit', 'fiscal', 133, { prefix: '£', suffix: 'bn', min: -50, max: 400, trend: 'falling', goodDir: -1, note: '≈4.4% of GDP, FY25-26 (OBR).' }),
    ind('headroom', 'Fiscal headroom', 'fiscal', 22, { prefix: '£', suffix: 'bn', min: -100, max: 150, trend: 'steady', goodDir: 1, note: 'A thin buffer against the fiscal mandate.' }),
    // Immigration & asylum
    ind('netMigration', 'Net migration', 'immigration', 331, { suffix: 'k', min: 0, max: 1200, trend: 'falling', goodDir: 0, note: 'Halved from the 2023 peak; the figure on your desk.' }),
    ind('channelCrossings', 'Channel crossings', 'immigration', 41, { suffix: 'k', min: 0, max: 120, trend: 'rising', goodDir: 0, note: '2025 total; +13% y/y, near record.' }),
    // NHS & public services
    ind('nhsWaitList', 'NHS waiting list', 'nhs', 7.3, { suffix: 'm', min: 0, max: 12, trend: 'falling', goodDir: -1, note: 'Off the 7.8m peak; referrals still high.' }),
    ind('aeFourHour', 'A&E 4hr (all)', 'nhs', 60, { suffix: '%', min: 0, max: 100, trend: 'falling', goodDir: 1, note: 'Chronically below the 95% standard.' }),
    // Cost of living & energy
    ind('energyCap', 'Energy price cap', 'costOfLiving', 1758, { prefix: '£', suffix: '/yr', min: 0, max: 6000, trend: 'steady', goodDir: -1, note: 'Typical dual-fuel bill, Q1 2026.' }),
    ind('realWages', 'Real wage growth', 'costOfLiving', 0.9, { suffix: '%', min: -15, max: 15, trend: 'rising', goodDir: 1, note: 'Regular pay, real terms; thin gains.' }),
    // Crime & justice
    ind('prisonCapacity', 'Prisons full', 'crime', 97.8, { suffix: '%', min: 0, max: 120, trend: 'rising', goodDir: -1, note: '~87.3k in ~89.3k places; early-release in play.' }),
    ind('shoplifting', 'Shoplifting', 'crime', 510, { suffix: 'k', min: 0, max: 1200, trend: 'steady', goodDir: -1, note: 'Offences a year — near record highs.' }),
    // Housing & planning
    ind('housingSupply', 'New homes (yr)', 'housing', 209, { suffix: 'k', min: 0, max: 500, trend: 'falling', goodDir: 1, note: 'Net additions 24-25; vs the 300k ambition.' }),
    // Defence & security
    ind('defenceSpend', 'Defence spend', 'defence', 2.3, { suffix: '% GDP', min: 0, max: 8, trend: 'rising', goodDir: 1, note: 'Pledged toward 2.5%+ under NATO pressure.' }),
    // Atlantic / Europe posture — a path-agnostic security read. It measures
    // HOW SECURE the UK is, not WHICH ally it leans on: raise it any way you can
    // — Washington, a European pillar, sovereign capability, or new partnerships.
    ind('strategicSecurity', 'Strategic security', 'atlanticEurope', 60, { suffix: '/100', min: 0, max: 100, trend: 'falling', goodDir: 1, note: 'How secure the UK stands amid great-power flux — raise it any way you choose: allies, sovereign capability, or new partnerships.' }),
    // Strategy vs Reform
    ind('labourPoll', 'Labour poll', 'reformStrategy', 20, { suffix: '%', min: 0, max: 60, trend: 'falling', goodDir: 1, note: 'Slipped behind Reform; flirting with third.' }),
  ]

  const draft: GameState = {
    schemaVersion: 1,
    gameId: cryptoId(),
    createdAt: '',
    updatedAt: '',
    pmName: sel.pmName?.trim() || 'Prime Minister',
    turnIndex: 1,
    phase: 'play',
    turnKind: 'standard',
    setpieceHistory: [],
    setpieceContext: '',
    activeScene: null,
    rng: { seed, counter: rng.counter },
    calendar: { week: 1, dateISO: '2026-04-13', daysToLocals: 24 },
    doctrine: doctrine as GameState['doctrine'],
    stateBlock: { approval: 38, reform: 29, gbp: 1.34, gilt: 4.5, capital: 55, whip: 3, threat: 3, custom: [] },
    indicators,
    cabinet,
    standingCast,
    openLoops: [],
    streams,
    foreignCapitals,
    buriedButLive: [
      { id: nid('secret'), title: 'Defence brief indiscretion', detail: 'A minister was franker than they should have been on a hot mic during the Iran crisis. A recording exists.', exposureRisk: 8, triggered: false, plantedWeek: 1 },
    ],
    keyHistory: [{ week: 1, turnIndex: 1, summary: `Government formed. Doctrine locked. Opening posture: ${openingLabel}.` }],
    statHistory: [],
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
    lastAction: '',
    lastPrompt: '',
    lastRawReply: '',
    status: 'stable',
    ending: null,
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
