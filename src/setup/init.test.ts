import { describe, it, expect } from 'vitest'
import { initGameState, type SetupSelections } from './init'
import { serializeSnapshot } from '../prompt/builder'

const BASE: SetupSelections = {
  pmName: 'Test PM',
  offices: { chancellor: 'Tom Fielding', foreign: 'Clare Docherty', home: 'Yvette Cormack', defence: 'James Larkin' },
  innerMachine: { whip: 'Meg Harwell', cabinetOffice: 'Helen Prosser', comms: 'Jonny Rees', pps: 'Greg Tallis' },
  secondTierTheme: 'technocrats',
  doctrine: { immigration: 'B', economy: 'A', nhs: 'C', costOfLiving: 'B', crime: 'B', housing: 'A', atlanticEurope: 'C', defence: 'B', reformStrategy: 'C' },
}

describe('doctrine custom directives', () => {
  it('defaults to empty when none are given', () => {
    const s = initGameState(BASE, 'dir-seed')
    for (const k of Object.values(s.doctrine)) expect(k.directive).toBe('')
    expect(serializeSnapshot(s)).not.toContain('PM directive')
  })

  it('stores a trimmed directive on the chosen dial and surfaces it in the prompt', () => {
    const sel: SetupSelections = {
      ...BASE,
      doctrineDirectives: { immigration: '  No ECHR derogation without Cabinet sign-off.  ' },
    }
    const s = initGameState(sel, 'dir-seed')
    expect(s.doctrine.immigration.directive).toBe('No ECHR derogation without Cabinet sign-off.')
    expect(s.doctrine.economy.directive).toBe('') // untouched dials stay empty

    const snapshot = serializeSnapshot(s)
    expect(snapshot).toContain('PM directive: No ECHR derogation without Cabinet sign-off.')
  })
})

describe('national indicators', () => {
  it('seeds real-world indicators across macro, fiscal and doctrine domains', () => {
    const s = initGameState(BASE, 'ind-seed')
    const keys = s.indicators.map((i) => i.key)
    expect(keys).toContain('netMigration')
    expect(keys).toContain('nhsWaitList')
    expect(keys).toContain('inflation')
    expect(keys).toContain('deficit')
    expect(s.indicators.some((i) => i.domain === 'macro')).toBe(true)
    expect(s.indicators.some((i) => i.domain === 'fiscal')).toBe(true)
    expect(s.indicators.some((i) => i.domain === 'immigration')).toBe(true)
  })

  it('surfaces the indicators in the prompt snapshot with their keys', () => {
    const s = initGameState(BASE, 'ind-seed')
    const snapshot = serializeSnapshot(s)
    expect(snapshot).toContain('INDICATORS')
    expect(snapshot).toContain('[netMigration]')
    expect(snapshot).toContain('[nhsWaitList]')
  })
})
