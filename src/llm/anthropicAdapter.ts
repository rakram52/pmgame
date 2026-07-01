import type { Connection } from './types'
import { DELTA_JSON_SCHEMA } from './deltaJsonSchema'

/** POST to the Anthropic Messages API directly from the browser (allowed via
 *  the dangerous-direct-browser-access header for bring-your-own-key apps).
 *  Uses forced tool-use so the returned JSON is guaranteed schema-valid; we
 *  hand back the tool input serialized as a JSON string for the shared parser. */
export async function callAnthropic(conn: Connection, prompt: string, signal?: AbortSignal): Promise<string> {
  const url = conn.baseUrl.replace(/\/+$/, '') + '/v1/messages'
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': conn.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: conn.model,
      max_tokens: 4096,
      tools: [
        {
          name: 'submit_turn',
          description: 'Submit the narrated turn and all state changes as a single structured object.',
          input_schema: DELTA_JSON_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_turn' },
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${(await safeText(res)).slice(0, 300)}`)
  }
  const data = (await res.json()) as any
  const toolBlock = Array.isArray(data?.content) ? data.content.find((b: any) => b?.type === 'tool_use') : null
  if (!toolBlock?.input) {
    throw new Error('Model did not return the submit_turn tool call.')
  }
  return JSON.stringify(toolBlock.input)
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
