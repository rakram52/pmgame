import { describe, it, expect } from 'vitest'
import { chooseAction, applyReply, queueTurnKind } from './controller'
import { initGameState } from '../setup/init'
import type { GameState } from '../state/schema'

const SEL = {
  pmName: 'Flow PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

function reply(extra = ''): string {
  return `The scene unfolds.\n<<<DELTA\n{ "options": { "A": "a", "B": "b", "C": "c" }${extra} }\nDELTA>>>`
}

/** A mid-game, non-opening state ready to take a decision. */
function midGame(over: Partial<GameState> = {}): GameState {
  const s = initGameState(SEL, 'flow-seed')
  return { ...s, options: { A: 'a', B: 'b', C: 'c' }, optionRisks: { A: 'moderate', B: 'moderate', C: 'moderate' }, currentScene: 'A scene.', ...over }
}

describe('set-piece flow', () => {
  it('a Budget seed injection reaches the built prompt (US-201)', () => {
    const budgetWeek = midGame({ turnKind: 'budget' })
    const injection = 'FISCAL ENGINE: over by £5bn.'
    const acted = chooseAction(budgetWeek, "BUDGET — the PM's package: NHS +£8bn.", 'hard', [injection])
    expect(acted.pendingInjections).toContain(injection)
    expect(acted.lastPrompt).toContain(injection)
  })

  it('a queued set-piece is scheduled next turn, then cleared on commit (US-106)', () => {
    let s = queueTurnKind(midGame(), 'reshuffle')
    expect(s.queuedTurnKind).toBe('reshuffle')

    const acted = chooseAction(s, 'Do the thing', 'moderate')
    expect(acted.turnKind).toBe('reshuffle') // scheduler consumed the queue

    const r = applyReply(acted, reply(', "keyHistoryAppend": "Reshuffle done."'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.turnKind).toBe('reshuffle')
      expect(r.state.queuedTurnKind).toBeNull() // consumed
      expect(r.state.setpieceHistory.some((h) => h.kind === 'reshuffle')).toBe(true)
    }
  })

  it('election night fires when the locals expire, injects the result, and rolls the countdown on (US-501)', () => {
    const eve = midGame({ calendar: { week: 5, dateISO: '2026-05-07', daysToLocals: 0 } })
    const acted = chooseAction(eve, 'Face the country', 'moderate')
    expect(acted.turnKind).toBe('election')
    expect(acted.lastPrompt).toContain('ELECTION RESULT')

    const r = applyReply(acted, reply(', "keyHistoryAppend": "The locals delivered their verdict."'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.calendar.daysToLocals).toBeGreaterThan(300) // rolled to next cycle
    }
  })

  it('remembers the decision that drove the scene, for the "your move" echo', () => {
    const instruction = 'Summon the Chancellor; I want ECHR-compliant options by Friday.'
    const acted = chooseAction(midGame(), instruction, 'moderate')
    expect(acted.lastPrompt).toContain('ECHR-compliant options')
    const r = applyReply(acted, reply(', "keyHistoryAppend": "The PM tasked the Chancellor."'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.lastAction).toBe(instruction)
      expect(r.state.chosenAction).toBe('') // cleared, but remembered in lastAction
    }
  })

  it('stat history is appended (capped) on every commit (US-301)', () => {
    const acted = chooseAction(midGame(), 'A choice', 'moderate')
    const r = applyReply(acted, reply(', "stateBlock": { "approval": -2 }'))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.statHistory.length).toBeGreaterThan(0)
      const last = r.state.statHistory[r.state.statHistory.length - 1]
      expect(last.approval).toBe(36) // 38 − 2
    }
  })
})
