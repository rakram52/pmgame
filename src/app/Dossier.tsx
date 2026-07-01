import type { GameState } from '../state/schema'
import { TERMINAL_LOOP_STATUSES } from '../state/schema'
import { isLoopDue } from '../prompt/builder'

export function Dossier({ game }: { game: GameState }) {
  const liveLoops = game.openLoops.filter((l) => !TERMINAL_LOOP_STATUSES.includes(l.status))
  const doneLoops = game.openLoops.filter((l) => TERMINAL_LOOP_STATUSES.includes(l.status))
  const secrets = game.buriedButLive.filter((s) => s.triggered)

  return (
    <div class="dossier screen-scroll">
      <h3 class="sec">Open loops</h3>
      {liveLoops.length === 0 && <p class="empty">No open taskings. Commission something in a scene and it'll be tracked here.</p>}
      <ul class="loops">
        {liveLoops.map((l) => (
          <li key={l.id} class={isLoopDue(l, game.calendar.week) ? 'loop due' : 'loop'}>
            <div class="loop-title">
              {l.who && <span class="loop-who">{l.who}</span>} {l.title}
              {isLoopDue(l, game.calendar.week) && <span class="due-badge">DUE</span>}
            </div>
            <div class="loop-meta">
              due W{l.dueWeek} · {l.status}
            </div>
            {l.detail && <div class="loop-detail">{l.detail}</div>}
          </li>
        ))}
      </ul>

      <h3 class="sec">Slow-moving streams</h3>
      <ul class="streams">
        {game.streams.map((s) => (
          <li key={s.id}>
            <span class={`trend t-${s.trend}`}>{s.trend === 'rising' ? '▲' : s.trend === 'falling' ? '▼' : '—'}</span>
            <span class="stream-name">{s.name}:</span> <span class="stream-read">{s.reading}</span>
          </li>
        ))}
      </ul>

      <h3 class="sec">Cabinet &amp; standing cast</h3>
      <ul class="cast">
        {[...game.cabinet, ...game.standingCast].map((m) => (
          <li key={m.id}>
            <span class="cast-name">{m.name}</span>
            <span class="cast-role">{m.role}</span>
            <span class={`standing ${m.standing < 0 ? 'neg' : m.standing > 30 ? 'pos' : ''}`}>{m.standing >= 0 ? `+${m.standing}` : m.standing}</span>
          </li>
        ))}
      </ul>

      <h3 class="sec">Foreign capitals</h3>
      <ul class="capitals">
        {game.foreignCapitals.map((c) => (
          <li key={c.id}>
            <span class="cap-name">{c.name}</span>
            <span class={`cap-read ${c.read < 0 ? 'neg' : 'pos'}`}>{c.read >= 0 ? `+${c.read}` : c.read}</span>
            <span class="cap-posture">{c.posture}</span>
          </li>
        ))}
      </ul>

      {secrets.length > 0 && (
        <>
          <h3 class="sec">Surfaced secrets</h3>
          <ul class="secrets">
            {secrets.map((s) => (
              <li key={s.id}>
                <strong>{s.title}</strong> — {s.detail}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 class="sec">Key history</h3>
      <ul class="history">
        {game.keyHistory.slice().reverse().map((h, i) => (
          <li key={i}>
            <span class="hist-week">W{h.week}</span> {h.summary}
          </li>
        ))}
      </ul>

      {doneLoops.length > 0 && (
        <>
          <h3 class="sec">Closed loops</h3>
          <ul class="loops closed">
            {doneLoops.map((l) => (
              <li key={l.id} class="loop">
                <div class="loop-title">
                  {l.title} <span class="loop-meta">— {l.status}</span>
                </div>
                {l.resolutionNote && <div class="loop-detail">{l.resolutionNote}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
