import { describe, it, expect, vi, afterEach } from 'vitest'
import { callOpenAI } from './openaiAdapter'
import { callAnthropic } from './anthropicAdapter'
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
