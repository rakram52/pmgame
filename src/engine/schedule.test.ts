import { describe, it, expect } from 'vitest'
import { initGameState } from '../setup/init'
import { scheduleTurnKind, foreignBeatDue, monthOf } from './schedule'
import { Rng } from './rng'
import { TURN_KIND_META, isSetpiece } from './turnKinds'
import type { GameState, TurnKind } from '../state/schema'

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

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const rng = () => new Rng('sch-seed', 0)

describe('scheduleTurnKind — priority order (US-101)', () => {
  it('the opening turn is always standard', () => {
    const s = { ...base(), chosenAction: '', options: null }
    expect(scheduleTurnKind(s, rng())).toBe('standard')
  })

  it('a player-queued set-piece wins outright', () => {
    const s = { ...base(), queuedTurnKind: 'reshuffle' as TurnKind }
    expect(scheduleTurnKind(s, rng())).toBe('reshuffle')
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

  it('fires PMQs on the domestic cadence when the House is sitting', () => {
    const s = { ...base(), calendar: { ...base().calendar, week: 4 } } // April → sitting
    expect(scheduleTurnKind(s, rng())).toBe('pmqs')
  })

  it('never schedules a set-piece directly after another (no back-to-back)', () => {
    const s = { ...base(), turnKind: 'pmqs' as TurnKind, calendar: { ...base().calendar, week: 4 } }
    expect(scheduleTurnKind(s, rng())).toBe('standard')
  })

  it('is deterministic (same inputs → same kind)', () => {
    const s = { ...base(), calendar: { ...base().calendar, week: 4 } }
    expect(scheduleTurnKind(s, rng())).toBe(scheduleTurnKind(s, rng()))
  })

  it('a live encounter holds the floor: its kind wins over every other trigger', () => {
    const scene = { kind: 'summit' as TurnKind, focus: 'Ankara', beat: 2, maxBeats: 3 }
    // Even with a hot threat board and an expired locals countdown, the live
    // summit keeps going until it resolves — we never cut away mid-conversation.
    const s = {
      ...base(),
      activeScene: scene,
      stateBlock: { ...base().stateBlock, threat: 5 },
      calendar: { ...base().calendar, daysToLocals: 0 },
      queuedTurnKind: 'reshuffle' as TurnKind,
    }
    expect(scheduleTurnKind(s, rng())).toBe('summit')
  })
})

describe('foreign calendar (US-502)', () => {
  it('summit beats recur every 6 weeks from week 5', () => {
    expect(foreignBeatDue(5)).toBe(true)
    expect(foreignBeatDue(11)).toBe(true)
    expect(foreignBeatDue(6)).toBe(false)
    expect(monthOf('2026-11-20')).toBe(11)
  })
})

/** Drive the scheduler across a run, mimicking what the reducer commits, so the
 *  balance guardrail can be asserted over N weeks (US-204). */
function simulate(weeks: number): { kinds: TurnKind[] } {
  let s = base()
  s = { ...s, calendar: { ...s.calendar, daysToLocals: 500 }, stateBlock: { ...s.stateBlock, threat: 3 } }
  const r = rng()
  const kinds: TurnKind[] = []
  let iso = s.calendar.dateISO
  for (let w = 1; w <= weeks; w++) {
    s.calendar.week = w
    s.calendar.dateISO = iso
    const kind = scheduleTurnKind(s, r)
    kinds.push(kind)
    // mimic the reducer's commit
    s.turnKind = kind
    if (isSetpiece(kind)) s.setpieceHistory.push({ week: w, turnIndex: w, kind })
    iso = addDays(iso, 7)
  }
  return { kinds }
}

describe('cadence & balance guardrail (US-204)', () => {
  const { kinds } = simulate(52)

  it('never runs two set-pieces back-to-back', () => {
    for (let i = 1; i < kinds.length; i++) {
      const both = isSetpiece(kinds[i]) && isSetpiece(kinds[i - 1])
      expect(both, `weeks ${i},${i + 1} = ${kinds[i - 1]},${kinds[i]}`).toBe(false)
    }
  })

  it('never runs three same-scope scheduled set-pieces in a row', () => {
    const scopes = kinds
      .filter((k) => TURN_KIND_META[k].scope && !TURN_KIND_META[k].reactive)
      .map((k) => TURN_KIND_META[k].scope)
    for (let i = 2; i < scopes.length; i++) {
      const three = scopes[i] === scopes[i - 1] && scopes[i] === scopes[i - 2]
      expect(three, `three ${scopes[i]} in a row at ${i}`).toBe(false)
    }
  })

  it('keeps a home↔abroad mix (both scopes appear, neither dwarfs the other)', () => {
    const setpieces = kinds.filter(isSetpiece)
    const dom = setpieces.filter((k) => TURN_KIND_META[k].scope === 'domestic').length
    const intl = setpieces.filter((k) => TURN_KIND_META[k].scope === 'international').length
    expect(dom).toBeGreaterThan(0)
    expect(intl).toBeGreaterThan(0)
    const minShare = Math.min(dom, intl) / (dom + intl)
    expect(minShare).toBeGreaterThanOrEqual(0.33)
  })

  it('produces genuine variety (multiple distinct set-pieces, <60% standard)', () => {
    const distinct = new Set(kinds.filter(isSetpiece))
    expect(distinct.size).toBeGreaterThanOrEqual(2)
    const standardShare = kinds.filter((k) => k === 'standard').length / kinds.length
    expect(standardShare).toBeLessThan(0.85)
  })
})
