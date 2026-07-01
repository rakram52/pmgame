import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runTurnAuto } from './controller'
import { initGameState } from '../setup/init'
import type { GameState } from '../state/schema'
import type { Connection } from '../llm/types'
import { exportJson } from '../persistence/store'
import { callModel } from '../llm/client'

vi.mock('../llm/client', () => ({ callModel: vi.fn() }))
const mockedCall = vi.mocked(callModel)

const SEL = {
  pmName: 'Auto PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}
const CONN: Connection = { apiType: 'openai', baseUrl: 'https://x/v1', apiKey: 'sk', model: 'm', enabled: true }

const validReply = JSON.stringify({
  scene: 'The Cabinet Room. Officials wait.',
  options: { A: 'Push on', B: 'Hedge', C: 'Retreat' },
  optionRisks: { A: 'hard', B: 'moderate', C: 'easy' },
  stateBlock: { approval: -1 },
  keyHistoryAppend: 'The PM acted.',
})

function decisionState(): GameState {
  const s = initGameState(SEL, 'auto-seed')
  return { ...s, options: { A: 'a', B: 'b', C: 'c' }, optionRisks: { A: 'moderate', B: 'moderate', C: 'moderate' }, chosenAction: 'Do the thing', chosenRisk: 'moderate' }
}

beforeEach(() => mockedCall.mockReset())

describe('runTurnAuto', () => {
  it('applies a valid JSON reply and advances the turn', async () => {
    mockedCall.mockResolvedValueOnce(validReply)
    const res = await runTurnAuto(decisionState(), CONN)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.state.turnIndex).toBe(2)
      expect(res.state.currentScene).toContain('Cabinet Room')
      expect(res.state.options?.A).toBe('Push on')
      expect(res.state.stateBlock.approval).toBe(37)
    }
    expect(mockedCall).toHaveBeenCalledTimes(1)
  })

  it('auto-repairs: invalid then valid, no user involvement', async () => {
    mockedCall.mockResolvedValueOnce('not json at all').mockResolvedValueOnce(validReply)
    const res = await runTurnAuto(decisionState(), CONN)
    expect(res.ok).toBe(true)
    expect(mockedCall).toHaveBeenCalledTimes(2)
    // the second call's prompt carries the repair note
    expect(mockedCall.mock.calls[1][1]).toContain('FAILED VALIDATION')
  })

  it('gives up after retries without corrupting state (atomic)', async () => {
    mockedCall.mockResolvedValue('still not valid')
    const res = await runTurnAuto(decisionState(), CONN)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toMatch(/validation/i)
      expect(res.prompt).toContain('OUTPUT CONTRACT') // chat-mode fallback prompt
    }
    expect(mockedCall).toHaveBeenCalledTimes(3)
  })

  it('returns a copy-paste fallback prompt on network error', async () => {
    mockedCall.mockRejectedValueOnce(new Error('Failed to fetch'))
    const res = await runTurnAuto(decisionState(), CONN)
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error).toBe('Failed to fetch')
      expect(res.prompt).toContain('<<<DELTA')
    }
  })
})

describe('save hygiene', () => {
  it('an exported save never contains the API key', () => {
    const json = exportJson(initGameState(SEL, 'seed'))
    expect(json).not.toContain('apiKey')
    expect(json).not.toContain('sk-')
  })
})
