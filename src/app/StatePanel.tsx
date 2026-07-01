import type { GameState } from '../state/schema'
import { THREAT_LABELS } from '../state/schema'
import { Gauge, ThreatPips, approvalTone, threatTone, type Tone } from './meters'
import { HomeWorldDashboard } from './progress'

function Stat({
  label,
  value,
  suffix = '',
  meter,
}: {
  label: string
  value: string | number
  suffix?: string
  meter?: { value: number; max?: number; tone?: Tone }
}) {
  return (
    <div class="stat">
      <div class="stat-val">
        {value}
        {suffix}
      </div>
      <div class="stat-label">{label}</div>
      {meter && <Gauge value={meter.value} max={meter.max} tone={meter.tone} />}
    </div>
  )
}

export function StatePanel({ game }: { game: GameState }) {
  const sb = game.stateBlock
  const threatLevel = Math.round(sb.threat)
  const threat = THREAT_LABELS[threatLevel - 1] ?? String(sb.threat)

  return (
    <div class="statepanel screen-scroll">
      <HomeWorldDashboard game={game} />

      <div class="grid">
        <Stat label="Approval" value={sb.approval} suffix="%" meter={{ value: sb.approval, tone: approvalTone(sb.approval) }} />
        <Stat label="Reform UK" value={sb.reform} suffix="%" meter={{ value: sb.reform, max: 50, tone: threatTone(sb.reform, 26, 32) }} />
        <Stat label="Political capital" value={sb.capital} suffix="/100" meter={{ value: sb.capital, tone: approvalTone(sb.capital) }} />
        <Stat label="Whip margin" value={sb.whip >= 0 ? `+${sb.whip}` : sb.whip} />
        <Stat label="GBP / USD" value={sb.gbp.toFixed(2)} />
        <Stat label="10y gilt" value={sb.gilt.toFixed(1)} suffix="%" />
        <div class="stat">
          <div class="stat-val stat-val-sm">{threat}</div>
          <div class="stat-label">Threat level</div>
          <ThreatPips level={sb.threat} />
        </div>
        <Stat label="Days to locals" value={game.calendar.daysToLocals} />
      </div>

      {sb.custom.length > 0 && (
        <>
          <h3 class="sec">Also tracking</h3>
          <div class="grid">
            {sb.custom.map((c) => (
              <Stat key={c.key} label={c.label} value={c.value} suffix={c.suffix} meter={{ value: c.value, max: c.max }} />
            ))}
          </div>
        </>
      )}

      <h3 class="sec">Doctrine (locked)</h3>
      <ul class="doctrine-list">
        {Object.entries(game.doctrine).map(([k, d]) => (
          <li key={k}>
            <div class="doc-row">
              <span class="doc-key">{k}</span>
              <span class="doc-val">
                {d.value} — {d.summary}
              </span>
            </div>
            {d.directive && <div class="doc-directive">↳ {d.directive}</div>}
          </li>
        ))}
      </ul>

      <div class="game-meta">
        <span>Turn {game.turnIndex}</span>
        <span>Status: {game.status}</span>
        <span>Seed {game.rng.seed.slice(0, 8)}… · roll #{game.rng.counter}</span>
      </div>
    </div>
  )
}
