import { describe, it, expect } from 'vitest'
import { healConnection, RETIRED_MODELS, presetById } from './presets'
import type { Connection } from './types'

const base: Connection = {
  apiType: 'openai',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: 'sk-test',
  model: 'deepseek/deepseek-chat-v3-0324:free',
  enabled: true,
  presetId: 'openrouter',
}

describe('healConnection', () => {
  it('swaps a retired model for its live replacement (new object)', () => {
    const healed = healConnection(base)
    expect(healed).not.toBe(base)
    expect(healed?.model).toBe(RETIRED_MODELS[base.model])
    // everything else preserved
    expect(healed?.apiKey).toBe('sk-test')
    expect(healed?.enabled).toBe(true)
  })

  it('heals to a model the OpenRouter preset still offers by default', () => {
    const healed = healConnection(base)
    expect(healed?.model).toBe(presetById('openrouter')?.defaultModel)
  })

  it('leaves a live model untouched (same object identity)', () => {
    const live: Connection = { ...base, model: 'qwen/qwen3-next-80b-a3b-instruct:free' }
    expect(healConnection(live)).toBe(live)
  })

  it('passes null through', () => {
    expect(healConnection(null)).toBeNull()
  })
})
