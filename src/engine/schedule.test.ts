import { describe, it, expect } from 'vitest'
import { initGameState } from '../setup/init'
import { scheduleTurnKind, summitFocusCapital, ripeSummitCapital, politicallyExposed, monthOf } from './schedule'
import { Rng } from './rng'
import type { GameState, OpenLoop, ForeignCapital, TurnKind } from '../state/schema'

const SEL = {
  pmName: 'Sched PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

/** A non-opening state (has a decision + options), ready for the scheduler. */
function base(): GameState {
  const s = initGameState(SEL, 'sch-seed')
  return {
    ...s,
    chosenAction: 'act',
    options: { A: 'a', B: 'b', C: 'c' },
    pendingRolls: { action: null, worldVariance: null, event: null },
  }
}

const rng = () => new Rng('sch-seed', 0)

function loop(over: Partial<OpenLoop> = {}): OpenLoop {
  return { id: 'l1', who: '', title: 't', detail: '', commissionedWeek: 1, dueWeek: 1, status: 'in-progress', resolutionNote: '', ...over }
}
function capital(name: string, over: Partial<ForeignCapital> = {}): ForeignCapital {
  return { id: `c-${name}`, name, read: 0, posture: '', lastUpdatedWeek: 1, ...over }
}
const withWhip = (w: number): GameState => ({ ...base(), stateBlock: { ...base().stateBlock, whip: w } })

describe('scheduleTurnKind — earned set-pieces (US-101)', () => {
  it('the opening turn is always standard', () => {
    const s = { ...base(), chosenAction: '', options: null }
    expect(scheduleTurnKind(s, rng())).toBe('standard')
  })

  it('a calm week — no ripe thread, a steady PM — stays standard (nothing sprung)', () => {
    expect(scheduleTurnKind(base(), rng())).toBe('standard')
  })

  it('fires election when the locals countdown has expired', () => {
    const s = { ...base(), calendar: { ...base().calendar, daysToLocals: 0 } }
    expect(scheduleTurnKind(s, rng())).toBe('election')
  })

  it('fires COBRA when the threat board is hot (>=4)', () => {
    const s = { ...base(), stateBlock: { ...base().stateBlock, threat: 4 } }
    expect(scheduleTurnKind(s, rng())).toBe('cobra')
  })

  it('reacts to a fresh security event with COBRA, a foreign event with a summit', () => {
    const sec = { ...base(), pendingRolls: { action: null, worldVariance: null, event: { roll: 6, category: 2, title: 'Terror plot', directive: '' } } }
    expect(scheduleTurnKind(sec, rng())).toBe('cobra')
    const foreign = { ...base(), pendingRolls: { action: null, worldVariance: null, event: { roll: 6, category: 4, title: 'Foreign crisis', directive: '' } } }
    expect(scheduleTurnKind(foreign, rng())).toBe('summit')
  })

  it('earns a summit when a foreign engagement loop the PM built comes due', () => {
    const s = {
      ...base(),
      foreignCapitals: [capital('Ankara', { read: 10 })],
      openLoops: [loop({ title: 'Arrange the bilateral with Ankara', dueWeek: 1 })],
    }
    expect(scheduleTurnKind(s, rng())).toBe('summit')
  })

  it('does NOT earn a summit from a foreign loop that is not about engagement', () => {
    const s = {
      ...base(),
      foreignCapitals: [capital('Ankara')],
      openLoops: [loop({ title: 'Ankara migration statistics review', dueWeek: 1 })],
    }
    expect(scheduleTurnKind(s, rng())).toBe('standard')
  })

  it('earns PMQs when the PM is politically exposed (whip gone sour) and the House sits', () => {
    expect(scheduleTurnKind(withWhip(-3), rng())).toBe('pmqs')
  })

  it('holds PMQs during the summer recess even when the PM is exposed', () => {
    const s = { ...withWhip(-3), calendar: { week: 20, dateISO: '2026-08-17', daysToLocals: 300 } }
    expect(scheduleTurnKind(s, rng())).toBe('standard')
  })

  it('never runs an earned set-piece directly after another (no back-to-back)', () => {
    const s = { ...withWhip(-3), turnKind: 'pmqs' as TurnKind }
    expect(scheduleTurnKind(s, rng())).toBe('standard')
  })

  it('fires the Budget in the autumn fixture window', () => {
    const s = { ...base(), calendar: { week: 30, dateISO: '2026-11-16', daysToLocals: 300 } }
    expect(scheduleTurnKind(s, rng())).toBe('budget')
  })

  it('a live encounter holds the floor over every other trigger', () => {
    const scene = { kind: 'summit' as TurnKind, focus: 'Ankara', beat: 2, maxBeats: 3 }
    // Even with a hot threat board and an expired locals countdown, the live
    // summit keeps going until it resolves — we never cut away mid-conversation.
    const s = {
      ...base(),
      activeScene: scene,
      stateBlock: { ...base().stateBlock, threat: 5 },
      calendar: { ...base().calendar, daysToLocals: 0 },
    }
    expect(scheduleTurnKind(s, rng())).toBe('summit')
  })

  it('is deterministic (same inputs → same kind)', () => {
    const s = withWhip(-3)
    expect(scheduleTurnKind(s, rng())).toBe(scheduleTurnKind(s, rng()))
  })
})

describe('summit focus follows the storyline (fixes the Ankara→Moscow jump)', () => {
  it('centres on the capital the PM has a ripe engagement with, not the most hostile one', () => {
    const s = {
      ...base(),
      foreignCapitals: [capital('Washington', { read: -35 }), capital('Ankara', { read: 10 })],
      openLoops: [loop({ title: 'Arrange the bilateral with Ankara', dueWeek: 1 })],
    }
    expect(ripeSummitCapital(s)).toBe('Ankara')
    expect(summitFocusCapital(s)).toBe('Ankara')
  })

  it('prefers the capital the live loops are most about even before one is due', () => {
    const s = {
      ...base(),
      foreignCapitals: [capital('Moscow', { read: -40 }), capital('Berlin', { read: 15 })],
      openLoops: [loop({ title: 'Deepen the Berlin defence partnership', dueWeek: 20 })],
    }
    expect(ripeSummitCapital(s)).toBeNull()
    expect(summitFocusCapital(s)).toBe('Berlin')
  })

  it('falls back to the most hostile capital with a named leader when no thread is live', () => {
    const s = { ...base(), openLoops: [], foreignCapitals: [capital('Washington', { read: -35 }), capital('Paris', { read: 10 })] }
    expect(ripeSummitCapital(s)).toBeNull()
    expect(summitFocusCapital(s)).toBe('Washington')
  })
})

describe('politicallyExposed', () => {
  it('true when the whip is deeply negative', () => {
    expect(politicallyExposed(withWhip(-3))).toBe(true)
  })

  it('true when tasks pile up overdue', () => {
    const s = {
      ...base(),
      calendar: { ...base().calendar, week: 10 },
      openLoops: [loop({ id: 'a', dueWeek: 5 }), loop({ id: 'b', dueWeek: 6 })],
    }
    expect(politicallyExposed(s)).toBe(true)
  })

  it('false for a steady PM with a healthy whip and no rot', () => {
    expect(politicallyExposed(base())).toBe(false)
  })
})

describe('calendar helpers', () => {
  it('reads the month from an ISO date', () => {
    expect(monthOf('2026-11-20')).toBe(11)
  })
})
