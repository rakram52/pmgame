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
    defaultModel: 'qwen/qwen3-next-80b-a3b-instruct:free',
    keyUrl: 'https://openrouter.ai/keys',
    note: 'Free open-source models. Needs a free OpenRouter key (no card). Models change — edit the model id if one stops working (e.g. meta-llama/llama-3.3-70b-instruct:free).',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    apiType: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Google’s OpenAI-compatible endpoint (AI Studio key). gemini-2.5-flash is the sweet spot — sharp prose, ~£1–2 for a full 300-turn game. For near-zero cost use gemini-2.5-flash-lite; for top quality, gemini-3.5-flash or gemini-3.1-pro-preview.',
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
    defaultModel: 'deepseek-v4-flash',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: 'Very cheap (~30–50p for a full 300-turn game via V4 Flash), strong quality. Prompts are sent to DeepSeek. deepseek-v4-flash is the sweet spot; use deepseek-v4-pro for higher quality. (The old deepseek-chat id retires 2026-07-24.)',
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

/**
 * OpenRouter retires free model slugs without notice (a saved connection then
 * 404s on one-tap). Map any known-dead slug to a currently-live replacement so
 * existing connections self-heal on load. Keep this list current.
 */
export const RETIRED_MODELS: Record<string, string> = {
  'deepseek/deepseek-chat-v3-0324:free': 'qwen/qwen3-next-80b-a3b-instruct:free',
  // DeepSeek retires the bare `deepseek-chat` alias 2026-07-24; V4 Flash is the
  // successor. No collision with OpenRouter's `deepseek/…`-prefixed slugs.
  'deepseek-chat': 'deepseek-v4-flash',
}

/** Swap a retired model id for its replacement. Returns a NEW object only when
 *  something changed, so callers can cheaply detect a heal by identity. Pure. */
export function healConnection(conn: Connection | null): Connection | null {
  if (!conn) return conn
  const replacement = RETIRED_MODELS[conn.model]
  return replacement ? { ...conn, model: replacement } : conn
}

/**
 * Currently-live OpenRouter free models, in preference order. Free models get
 * rate-limited (429) constantly and each routes to a different upstream, so if
 * the chosen one is throttled we transparently try the next. Best-effort — dead
 * entries just 404 and get skipped.
 */
export const FREE_FALLBACK_MODELS: string[] = [
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
]

/** The ordered list of models to try for a call: the chosen model first, then —
 *  for an OpenRouter free model only — the other free models as fallbacks. */
export function modelChain(conn: Connection): string[] {
  const primary = conn.model
  const isOpenRouter = conn.presetId === 'openrouter' || /openrouter\.ai/.test(conn.baseUrl)
  if (isOpenRouter && primary.endsWith(':free')) {
    return [primary, ...FREE_FALLBACK_MODELS.filter((m) => m !== primary)]
  }
  return [primary]
}
