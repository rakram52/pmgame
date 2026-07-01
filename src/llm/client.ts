import type { Connection } from './types'
import { callOpenAI } from './openaiAdapter'
import { callAnthropic } from './anthropicAdapter'

/** Dispatch a prompt to the configured provider and return the raw assistant
 *  text (which the shared delta parser then extracts + validates). */
export function callModel(conn: Connection, prompt: string, signal?: AbortSignal): Promise<string> {
  return conn.apiType === 'anthropic' ? callAnthropic(conn, prompt, signal) : callOpenAI(conn, prompt, signal)
}

/** Lightweight connectivity check for the Settings "Test" button. */
export async function testConnection(conn: Connection): Promise<{ ok: boolean; message: string }> {
  try {
    const reply = await callModel(
      conn,
      'Reply with a single JSON object: {"options":{"A":"ok","B":"ok","C":"ok"},"scene":"connection test"}. No prose outside the JSON.',
    )
    return { ok: true, message: `Connected. Model replied (${reply.length} chars).` }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}
