import type { Connection } from './types'
import { LlmHttpError } from './errors'

/** POST to any OpenAI-compatible /chat/completions endpoint (OpenRouter,
 *  DeepSeek, Groq, Ollama, custom). Requests a JSON object so the whole reply
 *  is the delta (with the narrative in `scene`). Returns the raw assistant text. */
export async function callOpenAI(conn: Connection, prompt: string, signal?: AbortSignal): Promise<string> {
  const url = joinUrl(conn.baseUrl, '/chat/completions')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${conn.apiKey}`,
  }
  // HTTP-Referer / X-Title are OpenRouter's attribution headers — only send them
  // there, so no app-identifying breadcrumb leaks to Google/DeepSeek/etc.
  if (conn.presetId === 'openrouter' || /openrouter\.ai/.test(conn.baseUrl)) {
    headers['HTTP-Referer'] = 'https://rakram52.github.io/pmgame/'
    headers['X-Title'] = 'The Sovereign Game'
  }
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: conn.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      // Ceiling only (you pay for tokens *generated*, not this cap) — bounds a
      // runaway reply. Set high enough that a thinking model's reasoning tokens
      // plus the scene + delta never get truncated.
      max_tokens: 8192,
    }),
  })
  if (!res.ok) {
    throw new LlmHttpError(res.status, `${res.status} ${res.statusText || ''}: ${(await safeText(res)).slice(0, 300)}`.trim())
  }
  const data = (await res.json()) as any
  // OpenRouter can return HTTP 200 with a provider error in the body (e.g. an
  // upstream 429). Surface it as the real status so retry/fallback can act.
  if (data?.error) {
    const code = typeof data.error?.code === 'number' ? data.error.code : 502
    throw new LlmHttpError(code, `${code}: ${JSON.stringify(data.error).slice(0, 300)}`)
  }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model returned no content.')
  }
  return content
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
