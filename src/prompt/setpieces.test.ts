import { describe, it, expect } from 'vitest'
import { buildTurnPrompt } from './builder'
import { initGameState } from '../setup/init'
import type { GameState, TurnKind } from '../state/schema'

const SEL = {
  pmName: 'SP PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

function stateWith(kind: TurnKind, ctx = ''): GameState {
  const s = initGameState(SEL, 'sp-seed')
  return { ...s, turnKind: kind, setpieceContext: ctx, chosenAction: 'act', options: { A: 'a', B: 'b', C: 'c' } }
}

const MARKER = 'THIS WEEK IS A SET PIECE'
const MODES = ['chat', 'api'] as const

describe('set-piece prompt modules (US-102)', () => {
  it('standard turns carry no set-piece section in either mode', () => {
    for (const mode of MODES) {
      expect(buildTurnPrompt(stateWith('standard'), mode)).not.toContain(MARKER)
    }
  })

  const cases: [TurnKind, RegExp][] = [
    ['pmqs', /PRIME MINISTER'S QUESTIONS/],
    ['summit', /FOREIGN SUMMIT/],
    ['cobra', /COBRA CRISIS/],
    ['budget', /BUDGET \/ FISCAL EVENT/],
    ['reshuffle', /CABINET RESHUFFLE/],
    ['election', /ELECTION NIGHT/],
  ]

  for (const [kind, re] of cases) {
    it(`${kind} injects its section in both modes`, () => {
      for (const mode of MODES) {
        const p = buildTurnPrompt(stateWith(kind, kind === 'summit' ? 'Washington' : ''), mode)
        expect(p).toContain(MARKER)
        expect(p).toMatch(re)
      }
    })
  }

  it('summit names the focus capital and its leader', () => {
    const p = buildTurnPrompt(stateWith('summit', 'Washington'), 'chat')
    expect(p).toContain('Washington')
    expect(p).toContain('Trump')
  })

  it('both output contracts are still honoured with a set-piece', () => {
    expect(buildTurnPrompt(stateWith('pmqs'), 'chat')).toContain('<<<DELTA')
    expect(buildTurnPrompt(stateWith('pmqs'), 'api')).toContain('SINGLE valid JSON object')
  })
})
