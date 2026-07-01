import { describe, it, expect } from 'vitest'
import { initGameState } from '../setup/init'
import { computeEnding, ENDING_META, TERM_END_WEEK } from './endings'
import type { GameState } from '../state/schema'

const SEL = {
  pmName: 'End PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

function withState(over: Partial<GameState['stateBlock']>, week = 10): GameState {
  const s = initGameState(SEL, 'end-seed')
  return { ...s, calendar: { ...s.calendar, week }, stateBlock: { ...s.stateBlock, ...over } }
}

describe('end-state detection (US-503)', () => {
  it('is null while the government is healthy', () => {
    expect(computeEnding(withState({ approval: 38, capital: 55, whip: 3 }))).toBeNull()
  })

  it("the government falls when it loses the party (capital) or the country (approval)", () => {
    expect(computeEnding(withState({ capital: 0 }))).toBe('fallen')
    expect(computeEnding(withState({ approval: 10 }))).toBe('fallen')
  })

  it('a collapsed majority is a confidence defeat', () => {
    expect(computeEnding(withState({ whip: -15 }))).toBe('defeated')
  })

  it('seeing out the term is a win; doing it well is a triumph', () => {
    expect(computeEnding(withState({ approval: 30, capital: 40, whip: 5 }, TERM_END_WEEK))).toBe('survived')
    expect(computeEnding(withState({ approval: 50, capital: 60, whip: 20 }, TERM_END_WEEK))).toBe('triumph')
  })

  it('a healthier state never produces a worse ending than a collapsed one', () => {
    const healthy = computeEnding(withState({ approval: 40, capital: 50, whip: 10 }))
    const collapsed = computeEnding(withState({ approval: 8, capital: 0, whip: -20 }))
    expect(healthy).toBeNull()
    expect(collapsed).not.toBeNull()
    expect(ENDING_META[collapsed!].won).toBe(false)
  })
})
