import { describe, it, expect } from 'vitest'
import { initGameState } from '../setup/init'
import { computeElectionResult, computeHeadroom, assessBudget, approvalMomentum } from './setpieceLogic'
import type { GameState } from '../state/schema'

const SEL = {
  pmName: 'Logic PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

function withApproval(approval: number): GameState {
  const s = initGameState(SEL, 'logic-seed')
  return { ...s, stateBlock: { ...s.stateBlock, approval } }
}

describe('election result (US-501)', () => {
  it('is monotone in approval: higher approval never gives a worse night', () => {
    let prev = -Infinity
    let prevSeats = -Infinity
    for (let a = 0; a <= 100; a += 5) {
      const r = computeElectionResult(withApproval(a))
      expect(r.score).toBeGreaterThanOrEqual(prev)
      expect(r.seatsSwing).toBeGreaterThanOrEqual(prevSeats)
      expect(r.stateDelta.capital).toBeGreaterThanOrEqual(-12)
      prev = r.score
      prevSeats = r.seatsSwing
    }
  })

  it('a strong approval is a triumph; a collapse is a rout', () => {
    expect(computeElectionResult(withApproval(60)).tier).toBe('triumph')
    expect(computeElectionResult(withApproval(10)).tier).toBe('rout')
  })

  it('the injection carries an exact, code-owned delta for the model to apply', () => {
    const r = computeElectionResult(withApproval(20))
    expect(r.injection).toContain('ELECTION RESULT')
    expect(r.injection).toContain(`approval ${r.stateDelta.approval >= 0 ? '+' : ''}${r.stateDelta.approval}`)
  })

  it('reads momentum from the stat history when present', () => {
    const s = withApproval(40)
    s.statHistory = [
      { week: 1, turnIndex: 1, approval: 34, reform: 29, capital: 55, whip: 3, gilt: 4.8, gbp: 1.19, threat: 3 },
      { week: 2, turnIndex: 2, approval: 40, reform: 29, capital: 55, whip: 3, gilt: 4.8, gbp: 1.19, threat: 3 },
    ]
    expect(approvalMomentum(s)).toBeGreaterThan(0)
  })
})

describe('budget headroom (US-201)', () => {
  it('tighter markets (higher gilt) shrink the headroom', () => {
    const easy = { ...withApproval(38), stateBlock: { ...withApproval(38).stateBlock, gilt: 4.0 } }
    const tight = { ...withApproval(38), stateBlock: { ...withApproval(38).stateBlock, gilt: 6.5 } }
    expect(computeHeadroom(tight)).toBeLessThan(computeHeadroom(easy))
  })

  it('over-committing surfaces a bigger market reaction; under-committing buys credibility', () => {
    const over = assessBudget(20, 35)
    expect(over.overcommitted).toBe(true)
    expect(over.injection).toMatch(/gilt UP/i)

    const under = assessBudget(20, 8)
    expect(under.undercommitted).toBe(true)
    expect(under.injection).toMatch(/credible|reassured/i)
  })
})
