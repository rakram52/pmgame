/**
 * Small, dependency-free HUD visualisations shared across the Play header,
 * State panel and Dossier. All pure presentation.
 */

export type Tone = 'good' | 'warn' | 'bad' | 'neutral'

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Signed integer for standings / reads: "+15", "0", "-40". */
export function signed(n: number): string {
  const r = Math.round(n)
  return r > 0 ? `+${r}` : String(r)
}

/**
 * Bipolar bar for −100..+100 values (minister standing, foreign read): a centre
 * tick, with the fill growing right (aligned / loyal, green) or left (hostile /
 * plotting, red) from the middle.
 */
export function BipolarBar({ value }: { value: number }) {
  const v = clamp(value, -100, 100)
  const half = Math.abs(v) / 2 // max 50% of the track
  const pos = v >= 0
  return (
    <div class="bar bipolar" role="img" aria-label={`${signed(v)} of 100`}>
      <div class="bar-mid" />
      <div class={`bar-fill ${pos ? 'pos' : 'neg'}`} style={{ width: `${half}%`, left: pos ? '50%' : `${50 - half}%` }} />
    </div>
  )
}

/** Unipolar gauge for 0..max values (approval, capital, reform…), coloured by tone. */
export function Gauge({ value, min = 0, max = 100, tone = 'neutral' }: { value: number; min?: number; max?: number; tone?: Tone }) {
  const pct = clamp(((value - min) / (max - min)) * 100, 0, 100)
  return (
    <div class="bar" role="img" aria-label={`${Math.round(value)} of ${max}`}>
      <div class={`bar-fill tone-${tone}`} style={{ width: `${pct}%`, left: 0 }} />
    </div>
  )
}

/** Five-pip threat indicator (1 LOW .. 5 CRITICAL). */
export function ThreatPips({ level }: { level: number }) {
  const n = clamp(Math.round(level), 1, 5)
  const heat = n >= 5 ? 'crit' : n >= 4 ? 'hot' : n >= 3 ? 'warm' : 'cool'
  return (
    <div class={`pips ${heat}`} role="img" aria-label={`Threat ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} class={`pip ${i <= n ? 'on' : ''}`} />
      ))}
    </div>
  )
}

/**
 * Tiny inline sparkline (US-302). Pure SVG, no libraries, no network. Renders
 * fine with a near-empty history (0–1 points draw a flat baseline).
 */
export function Sparkline({ values, tone = 'neutral', width = 52, height = 16 }: { values: number[]; tone?: Tone; width?: number; height?: number }) {
  const pad = 2
  const pts = values.slice(-16)
  const w = width
  const h = height
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const span = hi - lo || 1
  const stroke = tone === 'good' ? 'var(--green)' : tone === 'bad' ? 'var(--red)' : tone === 'warn' ? 'var(--amber)' : 'var(--ink-faint)'

  let d: string
  if (pts.length < 2) {
    const y = (h / 2).toFixed(1)
    d = `M${pad},${y} L${(w - pad).toFixed(1)},${y}`
  } else {
    const step = (w - pad * 2) / (pts.length - 1)
    d = pts
      .map((v, i) => {
        const x = pad + i * step
        const y = pad + (1 - (v - lo) / span) * (h - pad * 2)
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }
  return (
    <svg class="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={stroke} stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
    </svg>
  )
}

/**
 * ▲/▼/— arrow + signed last-turn delta (e.g. "▼ −3"). `goodDir` is +1 when a
 * rise is good for the PM (approval, capital) and −1 when a rise is bad (reform,
 * gilt, threat), which colours the tag.
 */
export function DeltaTag({ delta, goodDir = 1 }: { delta: number; goodDir?: 1 | -1 }) {
  const rounded = Math.round(delta * 100) / 100
  const arrow = rounded > 0 ? '▲' : rounded < 0 ? '▼' : '—'
  const cls = rounded === 0 ? 'flat' : rounded * goodDir > 0 ? 'up' : 'down'
  if (rounded === 0) return <span class="delta-tag flat">—</span>
  const shown = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return (
    <span class={`delta-tag ${cls}`}>
      {arrow} {rounded > 0 ? `+${shown}` : shown}
    </span>
  )
}

/** Last-turn change for a numeric field, from the tail of the stat history. */
export function lastSampleDelta(history: { [k: string]: number }[], key: string): number {
  if (history.length < 2) return 0
  return (history[history.length - 1][key] ?? 0) - (history[history.length - 2][key] ?? 0)
}

/** Tone for the PM's own approval (higher is better). */
export function approvalTone(v: number): Tone {
  return v >= 42 ? 'good' : v >= 33 ? 'warn' : 'bad'
}

/** Tone for a metric where a HIGH value is bad for the PM (Reform UK, gilts). */
export function threatTone(v: number, warnAt: number, badAt: number): Tone {
  return v >= badAt ? 'bad' : v >= warnAt ? 'warn' : 'good'
}
