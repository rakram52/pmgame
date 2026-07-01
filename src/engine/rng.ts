/**
 * Seeded, reproducible PRNG. The whole point: the APP rolls the dice, honestly
 * and deterministically, and the model only narrates the result. A save stores
 * `seed` + `counter`; on load we re-seed and fast-forward `counter` draws, so
 * the exact same sequence of rolls is reproduced every time (auditable, no drift).
 */

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private gen: () => number
  private _counter = 0

  constructor(seed: string, counter = 0) {
    const seedFn = xmur3(seed)
    this.gen = mulberry32(seedFn())
    for (let i = 0; i < counter; i++) this.raw()
  }

  private raw(): number {
    this._counter++
    return this.gen()
  }

  get counter(): number {
    return this._counter
  }

  /** float in [0, 1) */
  float(): number {
    return this.raw()
  }

  /** integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return min + Math.floor(this.raw() * (max - min + 1))
  }

  /** roll a die with `sides` faces → 1..sides */
  d(sides: number): number {
    return this.int(1, sides)
  }
}

/** Generate a fresh random seed for a new game (browser crypto if available). */
export function freshSeed(): string {
  try {
    const a = new Uint32Array(4)
    crypto.getRandomValues(a)
    return Array.from(a, (n) => n.toString(16).padStart(8, '0')).join('')
  } catch {
    // Deterministic-but-unique-enough fallback; never hit in a browser.
    return 'seed-' + Date.now().toString(16)
  }
}
