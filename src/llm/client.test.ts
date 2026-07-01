import { describe, it, expect, vi, afterEach } from 'vitest'
import { callOpenAI } from './openaiAdapter'
import { callAnthropic } from './anthropicAdapter'
import { runWithFallback } from './client'
import { modelChain, FREE_FALLBACK_MODELS } from './presets'
import { LlmHttpError } from './errors'
import type { Connection } from './types'

function fakeResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

afterEach(() => vi.unstubAllGlobals())

const oaConn: Connection = { apiType: 'openai', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-test', model: 'x/y:free', enabled: true }
const anConn: Connection = { apiType: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant', model: 'claude-haiku-4-5', enabled: true }

describe('openai adapter', () => {
  it('POSTs /chat/completions with json_object and returns content', async () => {
    const fetchMock = vi.fn(async () => fakeResponse({ choices: [{ message: { content: '{"options":{"A":"a","B":"b","C":"c"}}' } }] }))
    vi.stubGlobal('fetch', fetchMock)

    const out = await callOpenAI(oaConn, 'the prompt')
    expect(out).toContain('"options"')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('x/y:free')
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk-test' })
  })

  it('throws on non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ error: 'bad key' }, false, 401)))
    await expect(callOpenAI(oaConn, 'p')).rejects.toThrow(/401/)
  })

  it('surfaces an HTTP-200 provider error body as the real status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse({ error: { message: 'rate-limited upstream', code: 429 } })))
    await expect(callOpenAI(oaConn, 'p')).rejects.toMatchObject({ status: 429 })
  })
})

describe('modelChain', () => {
  it('appends free fallbacks for an OpenRouter free model', () => {
    const chain = modelChain({ ...oaConn, presetId: 'openrouter', model: FREE_FALLBACK_MODELS[0] })
    expect(chain[0]).toBe(FREE_FALLBACK_MODELS[0])
    expect(chain.length).toBe(FREE_FALLBACK_MODELS.length)
    expect(new Set(chain).size).toBe(chain.length) // no dupes
  })
  it('does not fall back for a paid / non-free model', () => {
    expect(modelChain({ ...oaConn, presetId: 'deepseek', model: 'deepseek-chat' })).toEqual(['deepseek-chat'])
  })
})

describe('runWithFallback', () => {
  const noSleep = () => Promise.resolve()

  it('returns the first model that answers', async () => {
    const call = vi.fn(async (m: string) => `ok:${m}`)
    expect(await runWithFallback(['a', 'b'], call, { sleep: noSleep })).toBe('ok:a')
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('falls through to the next model on a 429', async () => {
    const call = vi.fn(async (m: string) => {
      if (m === 'a') throw new LlmHttpError(429, 'rate limited')
      return `ok:${m}`
    })
    expect(await runWithFallback(['a', 'b'], call, { sleep: noSleep })).toBe('ok:b')
    expect(call.mock.calls.map((c) => c[0])).toEqual(['a', 'b'])
  })

  it('fails fast on an auth error without trying other models', async () => {
    const call = vi.fn(async () => {
      throw new LlmHttpError(401, 'bad key')
    })
    await expect(runWithFallback(['a', 'b'], call, { sleep: noSleep })).rejects.toMatchObject({ status: 401 })
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('retries the same model once on a 5xx blip', async () => {
    let n = 0
    const call = vi.fn(async () => {
      n++
      if (n === 1) throw new LlmHttpError(503, 'blip')
      return 'ok'
    })
    expect(await runWithFallback(['a'], call, { sleep: noSleep })).toBe('ok')
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('throws the last error once every model is exhausted', async () => {
    const call = vi.fn(async () => {
      throw new LlmHttpError(429, 'all rate limited')
    })
    await expect(runWithFallback(['a', 'b'], call, { sleep: noSleep })).rejects.toMatchObject({ status: 429 })
  })
})

describe('anthropic adapter', () => {
  it('sends the browser-access header + forced tool, returns tool input as JSON', async () => {
    const fetchMock = vi.fn(async () =>
      fakeResponse({ content: [{ type: 'tool_use', name: 'submit_turn', input: { options: { A: 'a', B: 'b', C: 'c' }, scene: 's' } }] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const out = await callAnthropic(anConn, 'the prompt')
    expect(JSON.parse(out).scene).toBe('s')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    expect(headers['x-api-key']).toBe('sk-ant')
    const body = JSON.parse(init.body as string)
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'submit_turn' })
    expect(body.tools[0].input_schema).toBeTruthy()
  })
})
