import { describe, it, expect } from 'vitest'
import { Rng } from './rng'

describe('Rng', () => {
  it('is deterministic for a given seed', () => {
    const a = new Rng('seed-abc', 0)
    const b = new Rng('seed-abc', 0)
    const seqA = Array.from({ length: 20 }, () => a.d(100))
    const seqB = Array.from({ length: 20 }, () => b.d(100))
    expect(seqA).toEqual(seqB)
  })

  it('reconstructs exactly via counter fast-forward', () => {
    const live = new Rng('seed-xyz', 0)
    const first = Array.from({ length: 7 }, () => live.d(100))
    const nextLive = live.d(100)

    // Reconstruct at counter=7 and confirm the next draw matches.
    const restored = new Rng('seed-xyz', 7)
    expect(restored.d(100)).toBe(nextLive)
    expect(first.length).toBe(7)
  })

  it('produces different streams for different seeds', () => {
    const a = Array.from({ length: 10 }, (_, i) => new Rng('seed-1', i).d(100))
    const b = Array.from({ length: 10 }, (_, i) => new Rng('seed-2', i).d(100))
    expect(a).not.toEqual(b)
  })

  it('d(n) stays within [1, n]', () => {
    const r = new Rng('bounds', 0)
    for (let i = 0; i < 500; i++) {
      const v = r.d(6)
      expect(v).toBeGreaterThanOrEqual(1)
      expect(v).toBeLessThanOrEqual(6)
    }
  })
})
