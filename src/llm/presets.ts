import type { Connection } from './types'

export interface Preset {
  id: string
  label: string
  apiType: Connection['apiType']
  baseUrl: string
  defaultModel: string
  /** Where to get a key (shown as a link in Settings). */
  keyUrl?: string
  note: string
  /** Whether the base URL is fixed (cloud) or user-supplied (local/custom). */
  editableBaseUrl?: boolean
}

/** OpenRouter's free tier is the recommended default — £0, one-tap, no backend. */
export const PRESETS: Preset[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter (free) ★',
    apiType: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-chat-v3-0324:free',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Free open-source models. Needs a free OpenRouter key (no card). Models change — edit the model id if one stops working.',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Haiku)',
    apiType: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-haiku-4-5',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    note: 'Best prose + rock-solid JSON via tool-use. ~£2 for a 300-turn game.',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    apiType: 'openai',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Very cheap (~70p / 300 turns), good quality.',
  },
  {
    id: 'groq',
    label: 'Groq',
    apiType: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    note: 'Fast and cheap, open-source models.',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    apiType: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'qwen2.5:32b',
    note: 'Runs on your own machine — £0, fully private. Set OLLAMA_ORIGINS=* and use your Tailscale/LAN address from your phone. Needs a capable computer (32B+ model).',
    editableBaseUrl: true,
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    apiType: 'openai',
    baseUrl: '',
    defaultModel: '',
    note: 'Any OpenAI-compatible /chat/completions endpoint.',
    editableBaseUrl: true,
  },
]

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}
