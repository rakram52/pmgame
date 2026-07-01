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

/** Tone for the PM's own approval (higher is better). */
export function approvalTone(v: number): Tone {
  return v >= 42 ? 'good' : v >= 33 ? 'warn' : 'bad'
}

/** Tone for a metric where a HIGH value is bad for the PM (Reform UK, gilts). */
export function threatTone(v: number, warnAt: number, badAt: number): Tone {
  return v >= badAt ? 'bad' : v >= warnAt ? 'warn' : 'good'
}
