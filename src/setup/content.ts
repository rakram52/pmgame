import type { Faction, DoctrineKey } from '../state/schema'

export interface Candidate {
  name: string
  faction: Faction
  blurb: string
  agenda: string
}

export interface OfficeChoice {
  key: string // role key
  role: string
  stake: string
  candidates: Candidate[]
}

export interface DoctrineOption {
  key: string // 'A' | 'B' | 'C'
  label: string
  detail: string
  upside: string
  downside: string
  consequence: string
}

export interface DoctrineChoice {
  key: DoctrineKey
  title: string
  note: string
  options: DoctrineOption[]
}

export interface SecondTierTheme {
  key: string
  label: string
  blurb: string
  ministers: { role: string; name: string; faction: Faction }[]
}

// --------------------------------------------------------------------------
// Setup Turn 1 — The Great Offices
// --------------------------------------------------------------------------

export const GREAT_OFFICES: OfficeChoice[] = [
  {
    key: 'chancellor',
    role: 'Chancellor of the Exchequer',
    stake: 'Whoever holds the red box holds your premiership by the throat.',
    candidates: [
      { name: 'Rachel Beaumont', faction: 'starmerite', blurb: 'Ex-Treasury fiscal hawk. Markets trust her.', agenda: 'Guard the fiscal rules — and quietly eye the top job.' },
      { name: 'Tom Fielding', faction: 'blue-labour', blurb: 'Red Wall, pro-worker, spend-to-grow.', agenda: 'Protect his marginal seats above all.' },
      { name: 'Priya Nandra', faction: 'soft-left', blurb: 'Investment-led, green, distrusts the City.', agenda: 'Reshape the state; break the Treasury orthodoxy.' },
    ],
  },
  {
    key: 'foreign',
    role: 'Foreign Secretary',
    stake: 'The world is about to start happening to you. This is your face to it.',
    candidates: [
      { name: 'Sir Alan Whitmore', faction: 'starmerite', blurb: 'Cautious Atlanticist, safe pair of hands.', agenda: 'Keep Washington close whatever the cost.' },
      { name: 'Clare Docherty', faction: 'soft-left', blurb: 'Human-rights lawyer, EU-warm.', agenda: 'Drive a European pivot.' },
      { name: 'Marcus Reeve', faction: 'blue-labour', blurb: 'Hard-nosed realist, sovereignty-first.', agenda: 'Transactional everywhere; owes no one.' },
    ],
  },
  {
    key: 'home',
    role: 'Home Secretary',
    stake: 'Immigration is 41 in the polls. This job is where you win or lose Reform.',
    candidates: [
      { name: 'Yvette Cormack', faction: 'starmerite', blurb: 'Control-and-competence technocrat.', agenda: 'Own the migration brief and the succession.' },
      { name: 'Daniel Osei', faction: 'soft-left', blurb: 'Reformist, civil-liberties instincts.', agenda: 'Rebalance policing; resist the crackdown.' },
      { name: 'Karen Blythe', faction: 'blue-labour', blurb: 'Tough, tabloid-fluent, hard on the boats.', agenda: 'Out-flank Farage from the right.' },
    ],
  },
  {
    key: 'defence',
    role: 'Defence Secretary',
    stake: 'Trump is musing on leaving NATO. This is your hedge.',
    candidates: [
      { name: 'James Larkin', faction: 'starmerite', blurb: 'NATO-first traditionalist.', agenda: 'Keep the Pentagon reassured.' },
      { name: 'Sophie Vane', faction: 'soft-left', blurb: 'Sceptical of spending, arms-control minded.', agenda: 'Resist the rearmament ratchet.' },
      { name: 'Iain McBride', faction: 'blue-labour', blurb: 'Rearmament hawk, shipbuilding jobs.', agenda: 'Sovereign UK forward; industrial dividend at home.' },
    ],
  },
]

// --------------------------------------------------------------------------
// Setup Turn 2 — Inner Machine + second-tier themes
// --------------------------------------------------------------------------

export const INNER_MACHINE: OfficeChoice[] = [
  {
    key: 'whip',
    role: 'Chief Whip',
    stake: 'Loyalist enforcer, or factional balancer? This choice sets the weather.',
    candidates: [
      { name: 'Frank Dolan', faction: 'starmerite', blurb: 'Ruthless, discreet, your man entirely.', agenda: 'Absolute loyalty — and leverage over everyone.' },
      { name: 'Meg Harwell', faction: 'blue-labour', blurb: 'Respected across every faction.', agenda: 'Keep the party whole, even against you.' },
      { name: 'Nadia Qureshi', faction: 'soft-left', blurb: 'Brings the left onside — for a price.', agenda: 'Protect the soft-left bloc.' },
    ],
  },
  {
    key: 'cabinetOffice',
    role: 'Cabinet Office Minister',
    stake: 'Your delivery enforcer inside the machine.',
    candidates: [
      { name: 'Paul Grieve', faction: 'official', blurb: 'Delivery-unit technocrat.', agenda: 'Metrics and grip; indifferent to politics.' },
      { name: 'Helen Prosser', faction: 'starmerite', blurb: 'Steady cross-department fixer.', agenda: 'Keep the show on the road.' },
      { name: 'Sam Okonkwo', faction: 'starmerite', blurb: 'Your loyalist, moves fast.', agenda: 'Whatever Number 10 needs.' },
    ],
  },
  {
    key: 'comms',
    role: 'Director of Communications',
    stake: 'The grid, the lobby, the war with the front pages.',
    candidates: [
      { name: 'Jonny Rees', faction: 'other', blurb: 'Attack-dog, tabloid whisperer.', agenda: 'Win the day; burn bridges later.' },
      { name: 'Fiona Blake', faction: 'other', blurb: 'Disciplined strategist, long grid.', agenda: 'Protect the PM from the PM.' },
      { name: 'Dev Mistry', faction: 'other', blurb: 'Digital-first, owns the feeds.', agenda: 'Fight Reform where they actually live — online.' },
    ],
  },
  {
    key: 'pps',
    role: 'PPS (eyes and ears)',
    stake: 'Your antenna in the tearoom.',
    candidates: [
      { name: 'Alice Fenn', faction: 'starmerite', blurb: 'Loyal, tireless, sees everything.', agenda: 'Serve you; misses nothing.' },
      { name: 'Greg Tallis', faction: 'blue-labour', blurb: 'Ambitious, extraordinarily well-connected.', agenda: 'Use the role as a springboard.' },
      { name: 'Ruth Kelmscott', faction: 'soft-left', blurb: 'Steady, discreet, trusted by the left.', agenda: 'Keep the backbenches from you — and you from them.' },
    ],
  },
]

export const SECOND_TIER_THEMES: SecondTierTheme[] = [
  {
    key: 'technocrats',
    label: 'Technocrats',
    blurb: 'Delivery over politics. Competent, low-drama, few allies on the benches.',
    ministers: [
      { role: 'Health', name: 'Dr. Anita Rao', faction: 'official' },
      { role: 'Education', name: 'Michael Fenwick', faction: 'official' },
      { role: 'Energy', name: 'Laura Simms', faction: 'official' },
      { role: 'Justice', name: 'Adeel Khan', faction: 'official' },
      { role: 'Business', name: 'Ravi Menon', faction: 'official' },
    ],
  },
  {
    key: 'balance',
    label: 'Factional Balance',
    blurb: 'A seat at the table for every wing. Stable, slow, quietly seething.',
    ministers: [
      { role: 'Health', name: 'Tom Bright', faction: 'blue-labour' },
      { role: 'Education', name: 'Sara Loach', faction: 'soft-left' },
      { role: 'Energy', name: 'Neil Amos', faction: 'starmerite' },
      { role: 'Justice', name: 'Farida Hussain', faction: 'soft-left' },
      { role: 'Business', name: 'Guy Latham', faction: 'blue-labour' },
    ],
  },
  {
    key: 'loyalists',
    label: 'Loyalists',
    blurb: 'Your people, top to bottom. Total grip now; a narrow base if it turns.',
    ministers: [
      { role: 'Health', name: 'Ben Cato', faction: 'starmerite' },
      { role: 'Education', name: 'Ellie Ward', faction: 'starmerite' },
      { role: 'Energy', name: 'Josh Penn', faction: 'starmerite' },
      { role: 'Justice', name: 'Marcus Hale', faction: 'starmerite' },
      { role: 'Business', name: 'Dawn Ferris', faction: 'starmerite' },
    ],
  },
  {
    key: 'outsiders',
    label: 'Outsiders',
    blurb: 'Big names from beyond politics. Headlines now, landmines later.',
    ministers: [
      { role: 'Health', name: 'Prof. Ian Voss', faction: 'independent' },
      { role: 'Education', name: 'Zara Bibi', faction: 'independent' },
      { role: 'Energy', name: 'Cal Brennan', faction: 'independent' },
      { role: 'Justice', name: 'Naomi Frost', faction: 'independent' },
      { role: 'Business', name: 'Owen Tate', faction: 'independent' },
    ],
  },
]

// --------------------------------------------------------------------------
// Setup Turn 3 — Doctrine & policy dials (each locks a consequence)
// --------------------------------------------------------------------------

export const DOCTRINE_DIALS: DoctrineChoice[] = [
  {
    key: 'immigration',
    title: '1. Immigration & Asylum',
    note: "Reform's oxygen. Ipsos has this on 41.",
    options: [
      { key: 'A', label: 'Hard restrictionist', detail: 'Net cap, offshore processing, ECHR Art.8 derogation, third-country removals.', upside: 'Neutralises Reform', downside: 'Judicial review, Lords revolt, Strasbourg crisis, Labour left mutiny', consequence: 'A flagship removals flight is grounded by an injunction — a Strasbourg confrontation looms.' },
      { key: 'B', label: 'Competent control', detail: 'Visa squeeze, faster decisions, returns deals, no ECHR fight.', upside: 'Defensible', downside: 'Reform calls it "more of the same"', consequence: 'A returns deal lands — modest numbers, but Reform brands it a con.' },
      { key: 'C', label: 'Liberal pragmatist', detail: 'Protect care/NHS/student visas, regularise long-resident undocumented.', upside: 'CBI cheers, NHS staffing eases', downside: 'Tabloid war, Red Wall haemorrhage', consequence: 'A tabloid front-page war erupts over an amnesty framing.' },
    ],
  },
  {
    key: 'economy',
    title: '2. Economy & Fiscal Stance',
    note: 'Economy is 32; headroom is narrow.',
    options: [
      { key: 'A', label: 'Iron Treasury', detail: 'Fiscal hawk, rebuild headroom.', upside: 'Markets calm', downside: 'Services starve', consequence: 'A department overspend forces an ugly in-year cut.' },
      { key: 'B', label: 'Pragmatic borrower', detail: 'Modest borrowing, rules bent not broken.', upside: 'Some delivery', downside: 'OBR scepticism', consequence: 'The OBR publishes a sceptical note on your fiscal path.' },
      { key: 'C', label: 'Growth reflation', detail: 'Break the rules, big stimulus.', upside: 'Real momentum if it works', downside: 'Gilt sell-off, IMF whispers', consequence: 'A gilt wobble tests your nerve; the whispers start.' },
    ],
  },
  {
    key: 'nhs',
    title: '3. NHS & Public Services',
    note: 'NHS is 26; strikes rolling.',
    options: [
      { key: 'A', label: 'Reform-and-restructure', detail: 'Productivity, private capacity, hold pay.', upside: 'Waiting lists move', downside: 'BMA war', consequence: 'The BMA escalates to indefinite action.' },
      { key: 'B', label: 'Pay-and-pause', detail: 'Settle strikes, defer reform.', upside: 'Wards reopen', downside: 'Treasury furious', consequence: 'The pay settlement blows a hole the Chancellor makes you own.' },
      { key: 'C', label: 'Rescue plan', detail: 'Emergency funding plus 10-year settlement bill.', upside: 'Defines the premiership', downside: 'Everything else crowded out', consequence: 'The NHS bill swallows the legislative agenda.' },
    ],
  },
  {
    key: 'costOfLiving',
    title: '4. Cost of Living & Energy',
    note: 'Live Iran shock; bills frozen only to July.',
    options: [
      { key: 'A', label: 'Universal cap extension', detail: 'Freeze bills through winter.', upside: 'Kills the cliff-edge', downside: '£20bn+ hole', consequence: 'The cap extension is costed at £22bn — the Treasury briefs against it.' },
      { key: 'B', label: 'Targeted support', detail: 'Bottom 40%, pensioners, rural heating-oil.', upside: 'Defensible', downside: 'Middle squeeze', consequence: 'A squeezed-middle backlash builds in the marginals.' },
      { key: 'C', label: 'Let the market clear', detail: 'Hardship fund only.', upside: 'Fiscal credibility', downside: 'Winter of discontent', consequence: 'Petrol queues and heating-oil anger become a winter story early.' },
    ],
  },
  {
    key: 'crime',
    title: '5. Crime, Policing & Justice',
    note: 'Prisons at capacity.',
    options: [
      { key: 'A', label: 'Tough and visible', detail: 'Emergency prison build, mandatory minimums.', upside: 'Tabloid friendly', downside: 'Prison officers strike', consequence: 'Prison officers ballot for action over overcrowding.' },
      { key: 'B', label: 'Sentencing reform', detail: 'Early release, community sentences.', upside: 'Decompresses fast', downside: 'One bad case eats the front pages', consequence: 'An early-release offender reoffends; the case dominates a news cycle.' },
      { key: 'C', label: 'Root causes', detail: 'Youth services, drug treatment.', upside: 'Long-game credibility', downside: 'Nothing visible before May', consequence: 'Opponents mock "nothing to show" as the locals approach.' },
    ],
  },
  {
    key: 'housing',
    title: '6. Housing & Planning',
    note: '',
    options: [
      { key: 'A', label: 'Build, baby, build', detail: 'Override local vetoes, green belt review.', upside: 'Growth story', downside: 'Shires uproar, JR storm', consequence: 'A green-belt review triggers a shires revolt and a judicial review.' },
      { key: 'B', label: 'Social housing surge', detail: 'Public build programme.', upside: 'Base energised', downside: 'Slow, expensive', consequence: 'The programme is real but invisibly slow; the base grows restless.' },
      { key: 'C', label: 'Demand-side tinkering', detail: 'Help-to-Buy revival.', upside: 'Cheap politics', downside: 'Pumps prices', consequence: 'Economists warn the scheme is pushing prices up, not access.' },
    ],
  },
  {
    key: 'atlanticEurope',
    title: '7. Atlantic & Europe Posture',
    note: 'The realist engine. The big one.',
    options: [
      { key: 'A', label: 'Repair Washington', detail: 'Eat the tariff, host Trump, NATO loyalist.', upside: 'Deters US abandonment short-term', downside: 'Public hates it, bandwagoning', consequence: 'A Trump visit is floated — the optics split your party and the public.' },
      { key: 'B', label: 'Cool transactional hedge', detail: 'Polite with Washington, deeper Paris/Berlin, customs-union talks.', upside: 'Public approval (57% want EU closer)', downside: 'Trump retaliation', consequence: 'Washington retaliates on a customs-union signal with a fresh tariff threat.' },
      { key: 'C', label: 'Open European pivot', detail: 'Single-market re-entry track, European defence pillar.', upside: 'Defines a generation', downside: 'Washington punishes hard, Reform brands you a traitor', consequence: 'Reform brands you a traitor; Washington signals real punishment.' },
    ],
  },
  {
    key: 'defence',
    title: '8. Defence & Security Doctrine',
    note: '',
    options: [
      { key: 'A', label: 'NATO-first traditionalist', detail: '2.5–3% of GDP, stay close to US.', upside: 'Pentagon reassured', downside: 'Exposed if Trump bolts', consequence: 'A US signal on NATO leaves your posture suddenly exposed.' },
      { key: 'B', label: 'European sovereign pillar', detail: 'Franco-British-German rearmament.', upside: 'Hedges US withdrawal', downside: 'Washington reads it as defection', consequence: 'Washington reads a European-pillar move as defection and cools fast.' },
      { key: 'C', label: 'Sovereign UK forward', detail: 'Nuclear modernisation, North Sea hardening, AUKUS.', upside: 'Cheaper, plays at home', downside: 'Isolates UK in Europe', consequence: 'Paris and Berlin quietly freeze you out of a key initiative.' },
    ],
  },
  {
    key: 'reformStrategy',
    title: '9. Political Strategy vs Reform UK',
    note: 'Existential before 7 May.',
    options: [
      { key: 'A', label: 'Squeeze', detail: 'Fight Reform on immigration and crime.', upside: 'Limits local damage', downside: "Legitimises Farage's frame", consequence: "Fighting on Reform's turf lifts their salience just before the locals." },
      { key: 'B', label: 'Ignore', detail: 'Campaign on competence.', upside: 'Dignified', downside: 'They grow in the silence', consequence: 'Reform climbs another point in the silence.' },
      { key: 'C', label: 'Co-opt', detail: 'Back-channel, offer Reform-curious MPs roles.', upside: "Splits Reform's coalition", downside: 'Labour members revolt, Guardian declares war', consequence: 'A back-channel leaks; Labour members and the Guardian erupt.' },
    ],
  },
]
