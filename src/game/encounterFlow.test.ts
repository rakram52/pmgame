import { describe, it, expect } from 'vitest'
import { chooseAction, applyReply } from './controller'
import { initGameState } from '../setup/init'
import { MAX_ENCOUNTER_BEATS } from '../engine/turnKinds'
import type { GameState } from '../state/schema'

/**
 * Multi-beat encounters (US-107): a high-stakes scene — a summit, or a contextual
 * 1:1 on an ordinary week — plays out over several beats that HOLD THE CLOCK, so
 * the week advances only when the encounter resolves. The engine owns the beats.
 */

const SEL = {
  pmName: 'Encounter PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

function reply(extra = ''): string {
  return `The scene unfolds.\n<<<DELTA\n{ "options": { "A": "a", "B": "b", "C": "c" }${extra} }\nDELTA>>>`
}

/** A quiet, mid-game standard week (no set-piece cadence, no election, no crisis). */
function midGame(over: Partial<GameState> = {}): GameState {
  const s = initGameState(SEL, 'enc-seed')
  return {
    ...s,
    options: { A: 'a', B: 'b', C: 'c' },
    optionRisks: { A: 'moderate', B: 'moderate', C: 'moderate' },
    currentScene: 'A scene.',
    calendar: { week: 3, dateISO: '2026-04-27', daysToLocals: 300 },
    ...over,
  }
}

describe('earned multi-beat set-piece (summit)', () => {
  it('runs three beats, holds the clock, then advances once and resolves', () => {
    // A foreign thread the PM built has ripened (a due "bilateral with Ankara"
    // loop) — that's what EARNS the summit, and it centres on Ankara, not on
    // whoever happens to be most hostile.
    const ripe = midGame({
      foreignCapitals: [{ id: 'c1', name: 'Ankara', read: 10, posture: '', lastUpdatedWeek: 1 }],
      openLoops: [
        { id: 'l1', who: 'FCDO', title: 'Arrange the bilateral with Ankara', detail: '', commissionedWeek: 1, dueWeek: 3, status: 'in-progress', resolutionNote: '' },
      ],
    })
    // Beat 1 — the summit opens; the engine holds the clock immediately.
    const b1 = chooseAction(ripe, 'Fly to Ankara for the bilateral', 'moderate')
    expect(b1.turnKind).toBe('summit')
    expect(b1.activeScene?.focus).toBe('Ankara') // storyline-driven, not most-hostile
    expect(b1.activeScene?.beat).toBe(1)
    expect(b1.activeScene?.maxBeats).toBe(3)

    const r1 = applyReply(b1, reply())
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.state.calendar.week).toBe(3) // clock held — still in the room
    expect(r1.state.activeScene?.beat).toBe(1)
    expect(r1.state.setpieceHistory.length).toBe(0) // not logged until it resolves

    // Beat 2 — the scheduler keeps the summit going; the clock stays frozen.
    const b2 = chooseAction(r1.state, 'Press him on the drones', 'hard')
    expect(b2.turnKind).toBe('summit')
    expect(b2.activeScene?.beat).toBe(2)
    const r2 = applyReply(b2, reply())
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.state.calendar.week).toBe(3) // still held
    expect(r2.state.activeScene?.beat).toBe(2)

    // Beat 3 — the FINAL beat. Even with no resolve signal, the engine ends it.
    const b3 = chooseAction(r2.state, 'Offer the deal', 'moderate')
    expect(b3.activeScene?.beat).toBe(3)
    const r3 = applyReply(b3, reply(', "keyHistoryAppend": "Ankara: a deal struck."'))
    expect(r3.ok).toBe(true)
    if (!r3.ok) return
    expect(r3.state.calendar.week).toBe(4) // NOW the week moves on
    expect(r3.state.activeScene).toBeNull() // encounter over
    expect(r3.state.setpieceHistory.filter((h) => h.kind === 'summit').length).toBe(1) // logged once
  })
})

describe('contextual 1:1 encounter on an ordinary week', () => {
  it('the narrator can open a clock-held briefing that the engine sustains', () => {
    const acted = chooseAction(midGame(), 'Summon the Chancellor; brief her on the covert plan.', 'hard')
    expect(acted.turnKind).toBe('standard')
    expect(acted.activeScene).toBeNull() // the engine does not open it — the narrator does

    const r = applyReply(acted, reply(', "encounter": { "open": true, "with": "the Chancellor", "beats": 3 }'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.activeScene?.focus).toBe('the Chancellor')
    expect(r.state.activeScene?.beat).toBe(1)
    expect(r.state.activeScene?.maxBeats).toBe(3)
    expect(r.state.calendar.week).toBe(3) // clock held — the conversation breathes
    expect(r.state.turnKind).toBe('standard') // no set-piece — an ordinary week

    // Next beat continues as standard, clock still held.
    const b2 = chooseAction(r.state, 'Reassure her but hold the line', 'moderate')
    expect(b2.turnKind).toBe('standard')
    expect(b2.activeScene?.beat).toBe(2)

    // The narrator resolves it early — the week advances now.
    const r2 = applyReply(b2, reply(', "encounter": { "resolve": true }, "keyHistoryAppend": "Chancellor squared away."'))
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.state.activeScene).toBeNull()
    expect(r2.state.calendar.week).toBe(4)
  })

  it('clamps a runaway beat request so an encounter can never stall the game', () => {
    const acted = chooseAction(midGame(), 'Confront the plotter', 'hard')
    const r = applyReply(acted, reply(', "encounter": { "open": true, "beats": 99 }'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.activeScene?.maxBeats).toBe(MAX_ENCOUNTER_BEATS)
  })

  it('ignores an open signal on a single-turn set-piece week (budget)', () => {
    // The Budget is the one fixed autumn fixture — a November date earns it.
    const budgetWeek = midGame({ calendar: { week: 3, dateISO: '2026-11-16', daysToLocals: 300 } })
    const acted = chooseAction(budgetWeek, 'BUDGET — package', 'hard')
    expect(acted.turnKind).toBe('budget')
    const r = applyReply(acted, reply(', "encounter": { "open": true, "with": "the OBR" }'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.activeScene).toBeNull() // structured set-pieces resolve in one turn
    expect(r.state.calendar.week).toBe(4) // the week advances as normal
  })
})
