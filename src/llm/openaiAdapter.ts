import type { Connection } from './types'

/** POST to any OpenAI-compatible /chat/completions endpoint (OpenRouter,
 *  DeepSeek, Groq, Ollama, custom). Requests a JSON object so the whole reply
 *  is the delta (with the narrative in `scene`). Returns the raw assistant text. */
export async function callOpenAI(conn: Connection, prompt: string, signal?: AbortSignal): Promise<string> {
  const url = joinUrl(conn.baseUrl, '/chat/completions')
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${conn.apiKey}`,
      // OpenRouter asks for these; harmless elsewhere.
      'HTTP-Referer': 'https://rakram52.github.io/pmgame/',
      'X-Title': 'The Sovereign Game',
    },
    body: JSON.stringify({
      model: conn.model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    }),
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${(await safeText(res)).slice(0, 300)}`)
  }
  const data = (await res.json()) as any
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
