import { describe, it, expect } from 'vitest'
import { forecast } from './forecast'
import { initGameState } from '../setup/init'
import type { GameState, OpenLoop } from '../state/schema'

const SEL = {
  pmName: 'Fore PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

/** A calm, quiet mid-game state: far from the locals, low threat, healthy whip. */
function calm(over: Partial<GameState> = {}): GameState {
  const s = initGameState(SEL, 'fore-seed')
  return {
    ...s,
    calendar: { week: 15, dateISO: '2026-07-13', daysToLocals: 300 },
    stateBlock: { ...s.stateBlock, threat: 2, whip: 3, approval: 45 },
    openLoops: [],
    ...over,
  }
}
const kinds = (s: GameState) => forecast(s).map((f) => f.kind)
function loop(over: Partial<OpenLoop> = {}): OpenLoop {
  return { id: 'l1', who: '', title: 't', detail: '', commissionedWeek: 1, dueWeek: 20, status: 'in-progress', resolutionNote: '', ...over }
}

describe('forecast — the horizon', () => {
  it('a genuinely calm week shows nothing on the horizon', () => {
    expect(forecast(calm())).toHaveLength(0)
  })

  it('counts down the locals when they are within range', () => {
    const s = calm({ calendar: { week: 15, dateISO: '2026-07-13', daysToLocals: 21 } })
    expect(kinds(s)).toContain('election')
    expect(forecast(s)[0].text).toMatch(/3 weeks/)
  })

  it('flags COBRA pressure when the threat board climbs', () => {
    expect(kinds(calm({ stateBlock: { ...calm().stateBlock, threat: 4 } }))).toContain('cobra')
  })

  it('surfaces a ripening summit tied to a due engagement loop', () => {
    const s = calm({
      foreignCapitals: [{ id: 'c1', name: 'Ankara', read: 10, posture: '', lastUpdatedWeek: 1 }],
      openLoops: [loop({ title: 'Arrange the bilateral with Ankara', dueWeek: 15 })],
    })
    const summit = forecast(s).find((f) => f.kind === 'summit')
    expect(summit?.text).toMatch(/Ankara/)
  })

  it('warns of a bruising PMQs when the PM is exposed and the House sits', () => {
    expect(kinds(calm({ stateBlock: { ...calm().stateBlock, whip: -4 } }))).toContain('pmqs')
  })

  it('brings the autumn Budget into view in October', () => {
    expect(kinds(calm({ calendar: { week: 28, dateISO: '2026-10-12', daysToLocals: 300 } }))).toContain('budget')
  })

  it('flags a slipping tasking and caps the list', () => {
    const s = calm({
      stateBlock: { ...calm().stateBlock, threat: 4, whip: -4 },
      calendar: { week: 15, dateISO: '2026-07-13', daysToLocals: 14 },
      openLoops: [loop({ id: 'a', status: 'stalled', dueWeek: 5 }), loop({ id: 'b', dueWeek: 16 })],
    })
    const fc = forecast(s)
    expect(fc.length).toBeLessThanOrEqual(4)
    expect(fc.some((f) => f.kind === 'loop' && /slipping/.test(f.text))).toBe(true)
  })
})
