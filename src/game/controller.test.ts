import { describe, it, expect } from 'vitest'
import { chooseAction, applyReply, prepareAndBuild } from './controller'
import { initGameState } from '../setup/init'
import type { GameState } from '../state/schema'

const SEL = {
  pmName: 'Golden PM',
  offices: { chancellor: 'Tom Fielding', foreign: 'Clare Docherty', home: 'Yvette Cormack', defence: 'James Larkin' },
  innerMachine: { whip: 'Meg Harwell', cabinetOffice: 'Helen Prosser', comms: 'Jonny Rees', pps: 'Greg Tallis' },
  secondTierTheme: 'technocrats',
  doctrine: { immigration: 'B', economy: 'A', nhs: 'C', costOfLiving: 'B', crime: 'B', housing: 'A', atlanticEurope: 'C', defence: 'B', reformStrategy: 'C' },
}

function reply(a: string, b: string, c: string, extra = ''): string {
  return `The scene unfolds. Officials talk.\n<<<DELTA\n{ "options": { "A": ${JSON.stringify(a)}, "B": ${JSON.stringify(b)}, "C": ${JSON.stringify(c)} }${extra} }\nDELTA>>>`
}

const SCRIPT: { action: string; risk: 'easy' | 'moderate' | 'hard' | 'desperate' | null; reply: string }[] = [
  { action: 'Back the Chancellor and hold the line on spending.', risk: 'moderate', reply: reply('Push further', 'Consolidate', 'Reverse', ', "stateBlock": { "approval": -2, "capital": -3 }, "openLoops": { "add": [ { "who": "Treasury", "title": "Model the winter cap", "dueInWeeks": 2 } ] }, "keyHistoryAppend": "Held the spending line."') },
  { action: 'Send the Foreign Sec to Berlin to sound out a defence pillar.', risk: 'hard', reply: reply('Deepen it', 'Hedge', 'Pull back', ', "foreignCapitals": [ { "name": "Berlin", "readDelta": 6 } ], "keyHistoryAppend": "Berlin sounded out."') },
  { action: 'Announce a visible crime crackdown before the locals.', risk: 'easy', reply: reply('Double down', 'Soften', 'Drop it', ', "stateBlock": { "reform": -1 }, "keyHistoryAppend": "Crime crackdown announced."') },
]

function runPlaythrough(): GameState {
  let s = initGameState(SEL, 'golden-seed-42')
  // opening
  s = prepareAndBuild(s)
  const opened = applyReply(s, reply('Open A', 'Open B', 'Open C', ', "keyHistoryAppend": "Government opens."'))
  expect(opened.ok).toBe(true)
  if (opened.ok) s = opened.state

  for (const step of SCRIPT) {
    s = chooseAction(s, step.action, step.risk)
    const r = applyReply(s, step.reply)
    expect(r.ok).toBe(true)
    if (r.ok) s = r.state
  }
  return s
}

function strip(s: GameState): Omit<GameState, 'gameId'> {
  const { gameId, ...rest } = s
  return rest
}

describe('golden replay', () => {
  it('produces byte-identical state on re-run (no drift, deterministic dice)', () => {
    const a = runPlaythrough()
    const b = runPlaythrough()
    expect(strip(a)).toEqual(strip(b))
  })

  it('advances to turn 4 and keeps the early open loop alive', () => {
    const s = runPlaythrough()
    expect(s.turnIndex).toBe(4)
    const loop = s.openLoops.find((l) => l.title.includes('winter cap'))
    expect(loop).toBeTruthy()
  })
})

describe('longevity smoke test (60 turns)', () => {
  it('keeps prompt size flat and never loses a tracked loop', () => {
    let s = initGameState(SEL, 'longevity-seed')
    s = prepareAndBuild(s)
    const opened = applyReply(s, reply('a', 'b', 'c', ', "openLoops": { "add": [ { "who": "Cab Sec", "title": "The eternal review", "dueInWeeks": 999 } ] }'))
    if (opened.ok) s = opened.state
    const eternalLoopExists = () => s.openLoops.some((l) => l.title === 'The eternal review')

    const promptSizes: number[] = []
    for (let i = 0; i < 60; i++) {
      s = chooseAction(s, `Decision number ${i}`, 'moderate')
      promptSizes.push(s.lastPrompt.length)
      const r = applyReply(s, reply('go on', 'pause', 'stop', ', "stateBlock": { "approval": 0 }, "keyHistoryAppend": "turn ' + i + '"'))
      expect(r.ok).toBe(true)
      if (r.ok) s = r.state
    }

    // Prompt should not grow unbounded with turn count.
    const first10 = promptSizes.slice(0, 10).reduce((a, b) => a + b, 0) / 10
    const last10 = promptSizes.slice(-10).reduce((a, b) => a + b, 0) / 10
    expect(last10).toBeLessThan(first10 * 1.6)
    expect(s.turnIndex).toBe(61)
    expect(eternalLoopExists()).toBe(true)
  })
})
