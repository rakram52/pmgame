import { describe, it, expect } from 'vitest'
import { extractDelta, extractProse } from './delta'

const goodReply = `Week 2 — Monday. The Cabinet Room is cold.

"We can't afford it," the Chancellor says.

**A)** Spend anyway. **B)** Trim it. **C)** Kill it.

<<<DELTA
{
  "options": { "A": "Spend anyway.", "B": "Trim it.", "C": "Kill it." },
  "optionRisks": { "A": "hard", "B": "moderate", "C": "easy" },
  "stateBlock": { "approval": -2, "capital": -4 },
  "keyHistoryAppend": "The PM faced the spending decision."
}
DELTA>>>`

describe('extractDelta', () => {
  it('extracts prose and a valid delta', () => {
    const res = extractDelta(goodReply)
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.delta.options.A).toBe('Spend anyway.')
      expect(res.delta.stateBlock?.approval).toBe(-2)
      expect(res.prose).toContain('Cabinet Room')
      expect(res.prose).not.toContain('DELTA')
    }
  })

  it('tolerates trailing commas and comments', () => {
    const messy = `Scene.
<<<DELTA
{
  "options": { "A": "a", "B": "b", "C": "c" }, // the three choices
  "stateBlock": { "approval": 1, },
}
DELTA>>>`
    const res = extractDelta(messy)
    expect(res.ok).toBe(true)
  })

  it('accepts a fenced ```delta block as fallback', () => {
    const fenced = 'Scene.\n```delta\n{ "options": { "A": "a", "B": "b", "C": "c" } }\n```'
    const res = extractDelta(fenced)
    expect(res.ok).toBe(true)
  })

  it('fails cleanly when the block is missing', () => {
    const res = extractDelta('Just some prose, no block at all.')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.stage).toBe('fence')
  })

  it('fails cleanly on invalid JSON', () => {
    const res = extractDelta('x <<<DELTA\n{ not json }\nDELTA>>>')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.stage).toBe('json')
  })

  it('fails schema validation when options are missing', () => {
    const res = extractDelta('x <<<DELTA\n{ "stateBlock": { "approval": 1 } }\nDELTA>>>')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.stage).toBe('schema')
  })

  it('takes the LAST delta block when the model restates', () => {
    const twice = `<<<DELTA
{ "options": { "A": "old", "B": "b", "C": "c" } }
DELTA>>>
On reflection:
<<<DELTA
{ "options": { "A": "new", "B": "b", "C": "c" } }
DELTA>>>`
    const res = extractDelta(twice)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.delta.options.A).toBe('new')
  })

  it('strips the delta block from prose', () => {
    expect(extractProse(goodReply)).not.toContain('optionRisks')
  })
})
