import { useState } from 'preact/hooks'
import type { GameState, Indicator } from '../state/schema'
import { THREAT_LABELS } from '../state/schema'
import { DOCTRINE_DIALS } from '../setup/content'
import { Gauge, ThreatPips, approvalTone, threatTone, type Tone } from './meters'
import { HomeWorldDashboard } from './progress'
import { SectionNav, TabView, type SectionDef } from './SectionNav'

type StateSection = 'standing' | 'economy' | 'doctrine'

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

/** Compact, English-formatted display of an indicator's value (£1,758/yr, 7.3m). */
function fmtIndicatorValue(i: Indicator): string {
  return `${i.prefix}${i.value.toLocaleString('en-GB')}${i.suffix}`
}

/** Trend arrow, coloured against the metric's "good direction" (green when it's
 *  moving the way the PM wants, red against, muted when contested/flat). */
function TrendMark({ i }: { i: Indicator }) {
  const arrow = i.trend === 'rising' ? '▲' : i.trend === 'falling' ? '▼' : '—'
  let tone = 'flat'
  if (i.goodDir !== 0 && i.trend !== 'steady') {
    const dir = i.trend === 'rising' ? 1 : -1
    tone = dir === i.goodDir ? 'good' : 'bad'
  }
  return <span class={`ind-trend ${tone}`}>{arrow}</span>
}

/** A full indicator tile for the Economy dashboards. */
function IndicatorTile({ i }: { i: Indicator }) {
  return (
    <div class="ind-tile">
      <div class="ind-top">
        <span class="ind-value">{fmtIndicatorValue(i)}</span>
        <TrendMark i={i} />
      </div>
      <div class="ind-label">{i.label}</div>
      {i.note && <div class="ind-note">{i.note}</div>}
    </div>
  )
}

/** A compact metric chip hung under a doctrine dial. */
function IndicatorChip({ i }: { i: Indicator }) {
  return (
    <span class="ind-chip" title={i.note}>
      <span class="ind-chip-label">{i.label}</span>
      <span class="ind-chip-val">{fmtIndicatorValue(i)}</span>
      <TrendMark i={i} />
    </span>
  )
}

export function StatePanel({ game }: { game: GameState }) {
  const [section, setSection] = useState<StateSection>('standing')
  const sb = game.stateBlock
  const threatLevel = Math.round(sb.threat)
  const threat = THREAT_LABELS[threatLevel - 1] ?? String(sb.threat)

  const macro = game.indicators.filter((i) => i.domain === 'macro')
  const fiscal = game.indicators.filter((i) => i.domain === 'fiscal')

  const sections: SectionDef[] = [
    { key: 'standing', label: 'Standing' },
    { key: 'economy', label: 'Economy' },
    { key: 'doctrine', label: 'Doctrine' },
  ]

  return (
    <TabView>
      <SectionNav sections={sections} active={section} onSelect={(k) => setSection(k as StateSection)} />
      <div class="statepanel screen-scroll">
        {section === 'standing' && (
          <>
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

            <div class="game-meta">
              <span>Turn {game.turnIndex}</span>
              <span>Status: {game.status}</span>
              <span>Seed {game.rng.seed.slice(0, 8)}… · roll #{game.rng.counter}</span>
            </div>
          </>
        )}

        {section === 'economy' && (
          <>
            <h3 class="sec">The economy</h3>
            <p class="sec-note">Where the country's numbers actually sit — the backdrop every decision plays against.</p>
            {macro.length > 0 ? (
              <div class="ind-grid">
                {macro.map((i) => (
                  <IndicatorTile key={i.key} i={i} />
                ))}
              </div>
            ) : (
              <p class="empty">No economic indicators tracked for this game.</p>
            )}

            {fiscal.length > 0 && (
              <>
                <h3 class="sec">The budget</h3>
                <div class="ind-grid">
                  {fiscal.map((i) => (
                    <IndicatorTile key={i.key} i={i} />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {section === 'doctrine' && (
          <>
            <h3 class="sec">Government doctrine</h3>
            <p class="sec-note">The policy dials you locked when forming the government, with the key metrics each is judged on. They steer every scene the narrator writes.</p>
            <ul class="doctrine-list">
              {DOCTRINE_DIALS.map((dial) => {
                const d = game.doctrine[dial.key]
                if (!d) return null
                const opt = dial.options.find((o) => o.key === d.value)
                const title = dial.title.replace(/^\d+\.\s*/, '')
                const metrics = game.indicators.filter((i) => i.domain === dial.key)
                return (
                  <li key={dial.key} class="doc-item">
                    <div class="doc-head">
                      <span class="doc-title">{title}</span>
                      {d.value.length <= 2 && <span class="doc-badge">{d.value}</span>}
                    </div>
                    <div class="doc-stance">{d.summary || opt?.label}</div>
                    {opt?.detail && <div class="doc-detail">{opt.detail}</div>}
                    {metrics.length > 0 && (
                      <div class="ind-chips">
                        {metrics.map((i) => (
                          <IndicatorChip key={i.key} i={i} />
                        ))}
                      </div>
                    )}
                    {d.directive && (
                      <div class="doc-directive">
                        <span class="doc-directive-label">Your standing instruction</span>
                        {d.directive}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </TabView>
  )
}
