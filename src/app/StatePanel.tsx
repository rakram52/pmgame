import type { GameState } from '../state/schema'
import { THREAT_LABELS } from '../state/schema'

function Stat({ label, value, suffix = '' }: { label: string; value: string | number; suffix?: string }) {
  return (
    <div class="stat">
      <div class="stat-val">
        {value}
        {suffix}
      </div>
      <div class="stat-label">{label}</div>
    </div>
  )
}

export function StatePanel({ game }: { game: GameState }) {
  const sb = game.stateBlock
  const threat = THREAT_LABELS[Math.round(sb.threat) - 1] ?? String(sb.threat)
  return (
    <div class="statepanel screen-scroll">
      <div class="grid">
        <Stat label="Approval" value={sb.approval} suffix="%" />
        <Stat label="Reform UK" value={sb.reform} suffix="%" />
        <Stat label="Political capital" value={sb.capital} suffix="/100" />
        <Stat label="Whip margin" value={sb.whip >= 0 ? `+${sb.whip}` : sb.whip} />
        <Stat label="GBP / USD" value={sb.gbp.toFixed(2)} />
        <Stat label="10y gilt" value={sb.gilt.toFixed(1)} suffix="%" />
        <Stat label="Threat" value={threat} />
        <Stat label="Days to locals" value={game.calendar.daysToLocals} />
      </div>

      {sb.custom.length > 0 && (
        <>
          <h3 class="sec">Also tracking</h3>
          <div class="grid">
            {sb.custom.map((c) => (
              <Stat key={c.key} label={c.label} value={c.value} suffix={c.suffix} />
            ))}
          </div>
        </>
      )}

      <h3 class="sec">Doctrine (locked)</h3>
      <ul class="doctrine-list">
        {Object.entries(game.doctrine).map(([k, d]) => (
          <li key={k}>
            <span class="doc-key">{k}</span>
            <span class="doc-val">
              {d.value} — {d.summary}
            </span>
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
