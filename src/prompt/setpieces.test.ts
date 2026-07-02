import { describe, it, expect } from 'vitest'
import { buildTurnPrompt } from './builder'
import { initGameState } from '../setup/init'
import type { GameState, TurnKind, ActiveScene } from '../state/schema'

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

const ENCOUNTER = 'LIVE ENCOUNTER — STAY IN THE ROOM'

function withScene(kind: TurnKind, scene: ActiveScene, ctx = ''): GameState {
  return { ...stateWith(kind, ctx), activeScene: scene }
}

describe('live-encounter beat framing (multi-beat encounters)', () => {
  it('no encounter section when no scene is live', () => {
    expect(buildTurnPrompt(stateWith('standard'), 'chat')).not.toContain(ENCOUNTER)
  })

  it('a mid-encounter beat holds the clock and asks for one exchange', () => {
    const p = buildTurnPrompt(withScene('summit', { kind: 'summit', focus: 'Ankara', beat: 1, maxBeats: 3 }, 'Ankara'), 'chat')
    expect(p).toContain(ENCOUNTER)
    expect(p).toContain('BEAT 1 of up to 3')
    expect(p).toContain('Ankara')
    expect(p).toMatch(/do NOT advance time/i)
  })

  it('the final beat brings it to a head and resolves', () => {
    const p = buildTurnPrompt(withScene('summit', { kind: 'summit', focus: 'Ankara', beat: 3, maxBeats: 3 }, 'Ankara'), 'api')
    expect(p).toContain('FINAL beat')
    expect(p).toContain('"resolve": true')
  })

  it('a contextual 1:1 on a standard week still gets the encounter section', () => {
    const p = buildTurnPrompt(withScene('standard', { kind: 'standard', focus: 'the Chancellor', beat: 2, maxBeats: 3 }), 'chat')
    expect(p).toContain(ENCOUNTER)
    expect(p).toContain('the Chancellor')
    // ...but no set-piece section, since the week itself is ordinary.
    expect(p).not.toContain(MARKER)
  })
})
