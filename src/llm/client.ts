import type { Connection } from './types'
import { callOpenAI } from './openaiAdapter'
import { callAnthropic } from './anthropicAdapter'
import { modelChain } from './presets'
import { LlmHttpError, isAbortError } from './errors'

function dispatch(conn: Connection, prompt: string, signal?: AbortSignal): Promise<string> {
  return conn.apiType === 'anthropic' ? callAnthropic(conn, prompt, signal) : callOpenAI(conn, prompt, signal)
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

export interface FallbackOpts {
  signal?: AbortSignal
  /** Injectable for tests; defaults to a real timed sleep. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

/**
 * Try each model in order. For each: one quick retry on a server blip (5xx/408),
 * then move on. A rate-limit (429), a missing model (404) or an unsupported
 * request (400) jumps straight to the next model — different free models route
 * to different upstreams with independent limits. Auth errors (401/403) and
 * aborts fail fast. Throws the last error only once every model is exhausted.
 */
export async function runWithFallback(
  models: string[],
  call: (model: string) => Promise<string>,
  opts: FallbackOpts = {},
): Promise<string> {
  const nap = opts.sleep ?? sleep
  let lastErr: unknown = new Error('Model call failed.')

  for (let i = 0; i < models.length; i++) {
    const isLast = i === models.length - 1
    for (let attempt = 0; attempt < 2; attempt++) {
      if (opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        return await call(models[i])
      } catch (e) {
        if (isAbortError(e)) throw e
        lastErr = e
        const status = e instanceof LlmHttpError ? e.status : 0
        if (status === 401 || status === 403) throw e // auth: no model will help
        const serverBlip = status >= 500 || status === 408
        if (serverBlip && attempt === 0) {
          await nap(700, opts.signal) // brief pause, then retry the same model
          continue
        }
        if (!isLast) await nap(300, opts.signal) // hand off to the next model
        break
      }
    }
  }
  throw lastErr
}

/** Dispatch a prompt to the configured provider (with retry + free-model
 *  fallback) and return the raw assistant text for the shared delta parser. */
export function callModel(conn: Connection, prompt: string, signal?: AbortSignal): Promise<string> {
  return runWithFallback(modelChain(conn), (model) => dispatch({ ...conn, model }, prompt, signal), { signal })
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
