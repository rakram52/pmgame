import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { GameState } from '../state/schema'
import { THREAT_LABELS } from '../state/schema'
import { Gauge, BipolarBar, ThreatPips, Sparkline, DeltaTag, lastSampleDelta, approvalTone, threatTone } from './meters'
import { TURN_KIND_META } from '../engine/turnKinds'

// ---------------------------------------------------------------------------
// Derived indices
// ---------------------------------------------------------------------------

/** Foreign-alignment index: the mean of the foreign-capital reads (−100..+100),
 *  computed in code. Zero when there are no capitals. */
export function foreignAlignmentIndex(game: GameState): number {
  const caps = game.foreignCapitals
  if (!caps.length) return 0
  return Math.round(caps.reduce((a, c) => a + c.read, 0) / caps.length)
}

function fmtDelta(key: string, d: number): string {
  const r = key === 'gbp' ? Math.round(d * 100) / 100 : key === 'gilt' ? Math.round(d * 10) / 10 : Math.round(d)
  const s = key === 'gbp' ? r.toFixed(2) : key === 'gilt' ? r.toFixed(1) : String(r)
  return r > 0 ? `+${s}` : s
}

// ---------------------------------------------------------------------------
// US-303 — "Why it changed" post-turn trace (code truth, not re-narrated)
// ---------------------------------------------------------------------------

const TRACE_FIELDS: { key: string; label: string; goodDir: 1 | -1 }[] = [
  { key: 'approval', label: 'Approval', goodDir: 1 },
  { key: 'reform', label: 'Reform', goodDir: -1 },
  { key: 'capital', label: 'Capital', goodDir: 1 },
  { key: 'whip', label: 'Whip', goodDir: 1 },
  { key: 'threat', label: 'Threat', goodDir: -1 },
  { key: 'gilt', label: 'Gilt', goodDir: -1 },
  { key: 'gbp', label: 'GBP', goodDir: 1 },
]

export function WhyChanged({ game }: { game: GameState }) {
  const [open, setOpen] = useState(true)
  if (game.statHistory.length < 2) return null

  const changes = TRACE_FIELDS.map((f) => ({ ...f, d: lastSampleDelta(game.statHistory, f.key) })).filter((c) => Math.abs(c.d) > 0.0001)
  if (!changes.length) return null

  const because = game.keyHistory.length ? game.keyHistory[game.keyHistory.length - 1].summary : ''

  return (
    <div class="why">
      <button class="why-head" onClick={() => setOpen((o) => !o)}>
        <span>Why it changed</span>
        <span class="why-toggle">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div class="why-body">
          <div class="why-deltas">
            {changes.map((c) => (
              <span key={c.key} class={`why-d ${c.d * c.goodDir > 0 ? 'up' : 'down'}`}>
                {c.label} {fmtDelta(c.key, c.d)}
              </span>
            ))}
          </div>
          {because && <div class="why-because">“{because}”</div>}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// US-304 — Home ↔ World dashboard
// ---------------------------------------------------------------------------

export function HomeWorldDashboard({ game }: { game: GameState }) {
  const sb = game.stateBlock
  const align = foreignAlignmentIndex(game)
  const threatLevel = Math.round(sb.threat)

  const homeRows: { label: string; value: string; meter: JSX.Element; key: string; goodDir: 1 | -1 }[] = [
    { label: 'Approval', value: `${sb.approval}%`, meter: <Gauge value={sb.approval} tone={approvalTone(sb.approval)} />, key: 'approval', goodDir: 1 },
    { label: 'Reform UK', value: `${sb.reform}%`, meter: <Gauge value={sb.reform} max={50} tone={threatTone(sb.reform, 26, 32)} />, key: 'reform', goodDir: -1 },
    { label: 'Whip', value: sb.whip >= 0 ? `+${sb.whip}` : String(sb.whip), meter: <Gauge value={sb.whip} min={-20} max={40} tone={sb.whip < 0 ? 'bad' : 'good'} />, key: 'whip', goodDir: 1 },
    { label: 'Capital', value: `${sb.capital}`, meter: <Gauge value={sb.capital} tone={approvalTone(sb.capital)} />, key: 'capital', goodDir: 1 },
  ]

  return (
    <div class="dashboard">
      <div class="dash-col">
        <div class="dash-title home">Home</div>
        {homeRows.map((r) => (
          <div key={r.label} class="dash-row">
            <span class="dash-label">{r.label}</span>
            <span class="dash-value">
              {r.value} <DeltaTag delta={lastSampleDelta(game.statHistory, r.key)} goodDir={r.goodDir} />
            </span>
            {r.meter}
          </div>
        ))}
      </div>

      <div class="dash-col">
        <div class="dash-title world">World</div>
        <div class="dash-row">
          <span class="dash-label">Alignment</span>
          <span class="dash-value">{align >= 0 ? `+${align}` : align}</span>
          <BipolarBar value={align} />
        </div>
        <div class="dash-row">
          <span class="dash-label">Threat</span>
          <span class="dash-value">
            {THREAT_LABELS[threatLevel - 1] ?? sb.threat} <DeltaTag delta={lastSampleDelta(game.statHistory, 'threat')} goodDir={-1} />
          </span>
          <ThreatPips level={sb.threat} />
        </div>
        <div class="dash-row">
          <span class="dash-label">Threat trend</span>
          <span class="dash-value" />
          <Sparkline values={game.statHistory.map((s) => s.threat)} tone={threatTone(sb.threat, 4, 5)} />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// US-305 — Premiership timeline
// ---------------------------------------------------------------------------

function addDays(iso: string, days: number): string {
  try {
    const d = new Date(iso + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  } catch {
    return iso
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' })
  } catch {
    return iso
  }
}

export function Timeline({ game }: { game: GameState }) {
  // Reconstruct a week→date base from the current calendar (robust to drift).
  const base = addDays(game.calendar.dateISO, -(game.calendar.week - 1) * 7)
  const setpieceByWeek = new Map<number, string>()
  for (const sp of game.setpieceHistory) setpieceByWeek.set(sp.week, sp.kind)
  const approvalByWeek = new Map<number, number>()
  for (const s of game.statHistory) approvalByWeek.set(s.week, s.approval)

  const entries = game.keyHistory.slice().reverse()
  if (!entries.length) return <p class="empty">The story of your premiership will build here.</p>

  return (
    <ul class="timeline">
      {entries.map((h, i) => {
        const kind = setpieceByWeek.get(h.week)
        const approval = approvalByWeek.get(h.week)
        return (
          <li key={i} class="tl-item">
            <span class="tl-dot" />
            <div class="tl-body">
              <div class="tl-meta">
                <span class="tl-week">W{h.week}</span>
                <span class="tl-date">{fmtDate(addDays(base, (h.week - 1) * 7))}</span>
                {kind && kind !== 'standard' && <span class={`sp-chip sp-${kind}`}>{TURN_KIND_META[kind as keyof typeof TURN_KIND_META].label}</span>}
                {approval != null && <span class="tl-approval">{approval}% approval</span>}
              </div>
              <div class="tl-summary">{h.summary}</div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
