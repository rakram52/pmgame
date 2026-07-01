import type { GameState, CastMember, ForeignCapital, OpenLoop } from '../state/schema'
import { TERMINAL_LOOP_STATUSES } from '../state/schema'
import { isLoopDue } from '../prompt/builder'
import { loopsForActor, loopsForCapital, resolveLoopActor, CAPITAL_LEADERS } from '../game/links'
import { BipolarBar, signed } from './meters'

/** A compact list of the loops an actor is carrying, with due flags. */
function TiedLoops({ label, loops, week }: { label: string; loops: OpenLoop[]; week: number }) {
  if (loops.length === 0) return null
  return (
    <div class="tied">
      <span class="tied-label">{label}</span>
      <ul class="tied-list">
        {loops.map((l) => (
          <li key={l.id} class={isLoopDue(l, week) ? 'due' : ''}>
            {l.title}
            {isLoopDue(l, week) && <span class="due-badge">DUE</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function standingWord(s: number): string {
  if (s <= -40) return 'plotting'
  if (s < 0) return 'restive'
  if (s < 20) return 'correct'
  if (s < 55) return 'onside'
  return 'loyal'
}

function CastCard({ m, loops, week }: { m: CastMember; loops: OpenLoop[]; week: number }) {
  const tied = loopsForActor(loops, m)
  const tone = m.standing < 0 ? 'neg' : m.standing > 30 ? 'pos' : ''
  return (
    <li class="person">
      <div class="person-head">
        <span class={`fdot f-${m.faction}`} />
        <span class="person-name">{m.name}</span>
        <span class={`standing-tag ${tone}`}>{signed(m.standing)}</span>
      </div>
      <div class="person-role">
        {m.role} · <span class="person-mood">{standingWord(m.standing)}</span>
      </div>
      <BipolarBar value={m.standing} />
      {m.agenda && <div class="person-agenda">“{m.agenda}”</div>}
      <TiedLoops label="Carrying" loops={tied} week={week} />
    </li>
  )
}

function CapitalCard({ c, loops, week }: { c: ForeignCapital; loops: OpenLoop[]; week: number }) {
  const leader = CAPITAL_LEADERS[c.name]
  const tied = loopsForCapital(loops, c)
  const tone = c.read < 0 ? 'neg' : 'pos'
  return (
    <li class="person">
      <div class="person-head">
        <span class="person-name">{c.name}</span>
        {leader && <span class="cap-leader">{leader}</span>}
        <span class={`standing-tag ${tone}`}>{signed(c.read)}</span>
      </div>
      <BipolarBar value={c.read} />
      {c.posture && <div class="person-agenda plain">{c.posture}</div>}
      <TiedLoops label="In play" loops={tied} week={week} />
    </li>
  )
}

export function Dossier({ game }: { game: GameState }) {
  const week = game.calendar.week
  const liveLoops = game.openLoops.filter((l) => !TERMINAL_LOOP_STATUSES.includes(l.status))
  const doneLoops = game.openLoops.filter((l) => TERMINAL_LOOP_STATUSES.includes(l.status))
  const secrets = game.buriedButLive.filter((s) => s.triggered)
  const dueCount = liveLoops.filter((l) => isLoopDue(l, week)).length

  return (
    <div class="dossier screen-scroll">
      <div class="sec-head">
        <h3 class="sec">Open loops</h3>
        {dueCount > 0 && <span class="sec-count due">{dueCount} due</span>}
        {dueCount === 0 && liveLoops.length > 0 && <span class="sec-count">{liveLoops.length}</span>}
      </div>
      {liveLoops.length === 0 && <p class="empty">No open taskings. Commission something in a scene and it'll be tracked here.</p>}
      <ul class="loops">
        {liveLoops.map((l) => {
          const actor = resolveLoopActor(l, game.cabinet, game.standingCast, game.foreignCapitals)
          const due = isLoopDue(l, week)
          return (
            <li key={l.id} class={due ? 'loop due' : 'loop'}>
              <div class="loop-title">
                {l.title}
                {due && <span class="due-badge">DUE</span>}
              </div>
              <div class="loop-owner">
                {actor?.kind === 'cast' ? (
                  <>
                    <span class={`fdot f-${actor.member.faction}`} />
                    <span class="owner-name">{actor.member.name}</span>
                    <span class="owner-role">{actor.member.role}</span>
                  </>
                ) : actor?.kind === 'capital' ? (
                  <>
                    <span class="owner-name">{actor.leader ?? actor.capital.name}</span>
                    <span class="owner-role">{actor.capital.name}</span>
                  </>
                ) : (
                  <span class="owner-name">{l.who || 'Number 10'}</span>
                )}
                <span class="owner-due">· due W{l.dueWeek} · {l.status}</span>
              </div>
              {l.detail && <div class="loop-detail">{l.detail}</div>}
            </li>
          )
        })}
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

      <h3 class="sec">Cabinet</h3>
      <ul class="people">
        {game.cabinet.map((m) => (
          <CastCard key={m.id} m={m} loops={liveLoops} week={week} />
        ))}
      </ul>

      {game.standingCast.length > 0 && (
        <>
          <h3 class="sec">Officials &amp; standing cast</h3>
          <ul class="people">
            {game.standingCast.map((m) => (
              <CastCard key={m.id} m={m} loops={liveLoops} week={week} />
            ))}
          </ul>
        </>
      )}

      <h3 class="sec">Foreign capitals</h3>
      <ul class="people">
        {game.foreignCapitals.map((c) => (
          <CapitalCard key={c.id} c={c} loops={liveLoops} week={week} />
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
