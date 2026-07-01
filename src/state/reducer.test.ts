import { describe, it, expect } from 'vitest'
import { applyDelta } from './reducer'
import type { TurnDelta } from './delta'
import { initGameState } from '../setup/init'
import type { GameState } from './schema'

const SEL = {
  pmName: 'Test PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

function base(): GameState {
  return initGameState(SEL, 'fixed-test-seed')
}

const minimalDelta: TurnDelta = { options: { A: 'a', B: 'b', C: 'c' } }

describe('applyDelta invariants', () => {
  it('never drops an open loop that the delta omits', () => {
    let s = base()
    // commission a loop
    const r1 = applyDelta({ ...s, chosenAction: 'Task the Treasury' }, { options: { A: 'a', B: 'b', C: 'c' }, openLoops: { add: [{ who: 'Treasury', title: 'Model the cost', dueInWeeks: 2 }] } }, 'scene')
    expect(r1.state.openLoops).toHaveLength(1)
    const loopId = r1.state.openLoops[0].id

    // a later turn that mentions nothing about the loop
    const r2 = applyDelta({ ...r1.state, chosenAction: 'Do something else' }, minimalDelta, 'scene 2')
    expect(r2.state.openLoops.find((l) => l.id === loopId)).toBeTruthy()
    expect(r2.state.openLoops[0].status).toBe('commissioned')
  })

  it('keyHistory is append-only', () => {
    let s = base()
    const before = s.keyHistory.length
    const r = applyDelta({ ...s, chosenAction: 'x' }, { ...minimalDelta, keyHistoryAppend: 'A thing happened.' }, 'scene')
    expect(r.state.keyHistory.length).toBe(before + 1)
    const r2 = applyDelta({ ...r.state, chosenAction: 'y' }, minimalDelta, 'scene')
    expect(r2.state.keyHistory.length).toBe(before + 1) // omitting append doesn't erase
  })

  it('clamps numeric deltas to legal ranges', () => {
    const s = base()
    const r = applyDelta({ ...s, chosenAction: 'x' }, { ...minimalDelta, stateBlock: { approval: 999, capital: -999 } }, 'scene')
    expect(r.state.stateBlock.approval).toBe(100)
    expect(r.state.stateBlock.capital).toBe(0)
  })

  it('surfaces (does not silently apply) a resolve for an unknown loop', () => {
    const s = base()
    const r = applyDelta({ ...s, chosenAction: 'x' }, { ...minimalDelta, openLoops: { resolve: [{ id: 'loop-nope', outcome: 'delivered' }] } }, 'scene')
    expect(r.warnings.join(' ')).toContain('loop-nope')
  })

  it('increments turnIndex only when a decision was made', () => {
    const s = base()
    const opening = applyDelta({ ...s, chosenAction: '' }, minimalDelta, 'opening scene')
    expect(opening.state.turnIndex).toBe(1) // opening does not advance
    const decision = applyDelta({ ...opening.state, chosenAction: 'Choose A' }, minimalDelta, 'scene')
    expect(decision.state.turnIndex).toBe(2)
  })

  it('advances the calendar ~one week per decision', () => {
    const s = base()
    const r = applyDelta({ ...s, chosenAction: 'Choose A' }, minimalDelta, 'scene')
    expect(r.state.calendar.week).toBe(2)
    expect(r.state.calendar.dateISO).toBe('2026-04-20')
    expect(r.state.calendar.daysToLocals).toBe(17)
  })

  it('computes crisis status from thresholds', () => {
    const s = base()
    // A modest capital hit tips into WOUNDED (capital < 20).
    const wounded = applyDelta({ ...s, chosenAction: 'x' }, { ...minimalDelta, stateBlock: { capital: -40 } }, 'scene')
    expect(wounded.state.stateBlock.capital).toBe(15)
    expect(wounded.state.status).toBe('wounded')
    // A catastrophic hit clamps capital to 0 → LOST.
    const lost = applyDelta({ ...s, chosenAction: 'x' }, { ...minimalDelta, stateBlock: { capital: -60 } }, 'scene')
    expect(lost.state.stateBlock.capital).toBe(0)
    expect(lost.state.status).toBe('lost')
  })

  it('creates a foreign capital by name when it does not exist', () => {
    const s = base()
    const r = applyDelta({ ...s, chosenAction: 'x' }, { ...minimalDelta, foreignCapitals: [{ name: 'Tokyo', readDelta: 5, posture: 'watchful' }] }, 'scene')
    expect(r.state.foreignCapitals.find((c) => c.name === 'Tokyo')).toBeTruthy()
  })
})
