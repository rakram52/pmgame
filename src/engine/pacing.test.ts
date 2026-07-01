import { describe, it, expect } from 'vitest'
import { prepareTurn } from './turn'
import { buildTurnPrompt } from '../prompt/builder'
import { initGameState } from '../setup/init'
import { SETTLING_WEEKS, EARLIEST_CONSEQUENCE_WEEK } from './pacing'
import type { GameState } from '../state/schema'

const SEL = {
  pmName: 'Pace PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

/** A state carrying a consequence + secret both eligible to fire immediately. */
function withHazards(week: number): GameState {
  const s = initGameState(SEL, 'pace-seed')
  return {
    ...s,
    chosenAction: 'act',
    calendar: { ...s.calendar, week },
    pendingRolls: null,
    pendingConsequences: [{ id: 'c1', source: '', description: 'DOOM CONSEQUENCE', triggerCondition: '', dueWeek: 1, fired: false }],
    buriedButLive: [{ id: 's1', title: 'A SECRET', detail: 'leaks', exposureRisk: 100, triggered: false, plantedWeek: 1 }],
  }
}

describe('settling-in grace (early weeks are for direction-setting)', () => {
  it('never lets a doctrine consequence fall in the settling weeks at setup', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const s = initGameState(SEL, seed)
      for (const pc of s.pendingConsequences) {
        expect(pc.dueWeek).toBeGreaterThanOrEqual(EARLIEST_CONSEQUENCE_WEEK)
      }
    }
  })

  it('holds back consequences AND secret exposures during the settling weeks', () => {
    for (let week = 1; week <= SETTLING_WEEKS; week++) {
      const p = prepareTurn(withHazards(week))
      const inj = p.pendingInjections.join(' ')
      expect(inj).not.toContain('DOOM CONSEQUENCE')
      expect(inj).not.toContain('A SECRET')
    }
  })

  it('lets them fire once the settling weeks are past', () => {
    const p = prepareTurn(withHazards(SETTLING_WEEKS + 1))
    const inj = p.pendingInjections.join(' ')
    expect(inj).toContain('DOOM CONSEQUENCE')
    expect(inj).toContain('A SECRET') // exposureRisk 100 → certain once eligible
  })

  it('injects a direction-setting steer into early prompts only', () => {
    const early = buildTurnPrompt(prepareTurn(withHazards(SETTLING_WEEKS)), 'chat')
    expect(early).toContain('SETTLING-IN')
    expect(early).toContain('setting DIRECTION')
    const later = buildTurnPrompt(prepareTurn(withHazards(SETTLING_WEEKS + 3)), 'chat')
    expect(later).not.toContain('SETTLING-IN')
  })
})
