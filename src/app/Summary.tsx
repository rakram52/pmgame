import type { GameState, Ending, KeyHistoryEntry } from '../state/schema'
import { ENDING_META, computeEnding } from '../engine/endings'
import { Sparkline } from './meters'
import { HomeWorldDashboard, foreignAlignmentIndex } from './progress'
import { TURN_KIND_META } from '../engine/turnKinds'

/** 3–5 defining moments: the opening, the finish, and the biggest set-piece
 *  beats in between. */
function definingMoments(game: GameState, n = 5): KeyHistoryEntry[] {
  const kh = game.keyHistory
  if (kh.length <= n) return kh
  const spWeeks = new Set(game.setpieceHistory.map((s) => s.week))
  const first = kh[0]
  const last = kh[kh.length - 1]
  const middle = kh.slice(1, -1)
  const spMids = middle.filter((h) => spWeeks.has(h.week))
  const fill = spMids.length >= n - 2 ? spMids : [...spMids, ...middle.filter((h) => !spWeeks.has(h.week))]
  const chosen = [first, ...fill.slice(0, n - 2), last]
  // dedupe by reference while preserving chronological order
  const seen = new Set<KeyHistoryEntry>()
  return chosen.filter((h) => (seen.has(h) ? false : (seen.add(h), true))).sort((a, b) => a.week - b.week)
}

export function Summary({ game, onNewGame }: { game: GameState; onNewGame?: () => void }) {
  const ending: Ending = game.ending ?? computeEnding(game) ?? 'fallen'
  const meta = ENDING_META[ending]
  const approvals = game.statHistory.map((s) => s.approval)
  const startApproval = approvals[0] ?? game.stateBlock.approval
  const endApproval = game.stateBlock.approval
  const arc = endApproval - startApproval
  const moments = definingMoments(game)
  const align = foreignAlignmentIndex(game)
  const spWeeks = new Map(game.setpieceHistory.map((s) => [s.week, s.kind]))

  return (
    <div class={`summary won-${meta.won}`}>
      <div class="summary-card">
        <div class="summary-crest">{meta.won ? '★' : '⚑'}</div>
        <h2 class="summary-title">{meta.title}</h2>
        <p class="summary-blurb">{meta.blurb}</p>

        <div class="summary-stats">
          <div class="sstat">
            <span class="sstat-val">{game.calendar.week}</span>
            <span class="sstat-label">weeks in office</span>
          </div>
          <div class="sstat">
            <span class="sstat-val">
              {endApproval}%
              <span class={`sstat-arc ${arc >= 0 ? 'up' : 'down'}`}>{arc >= 0 ? `+${arc}` : arc}</span>
            </span>
            <span class="sstat-label">final approval</span>
          </div>
          <div class="sstat">
            <span class="sstat-val">{align >= 0 ? `+${align}` : align}</span>
            <span class="sstat-label">world alignment</span>
          </div>
        </div>

        <div class="summary-arc">
          <div class="summary-arc-head">
            <span>Approval, {startApproval}% → {endApproval}%</span>
          </div>
          <Sparkline values={approvals.length ? approvals : [endApproval]} tone={arc >= 0 ? 'good' : 'bad'} width={280} height={44} />
        </div>

        <h3 class="summary-sec">Defining moments</h3>
        <ul class="summary-moments">
          {moments.map((h, i) => {
            const kind = spWeeks.get(h.week)
            return (
              <li key={i}>
                <span class="sm-week">W{h.week}</span>
                {kind && kind !== 'standard' && <span class={`sp-chip sp-${kind}`}>{TURN_KIND_META[kind].label}</span>}
                <span class="sm-text">{h.summary}</span>
              </li>
            )
          })}
        </ul>

        <h3 class="summary-sec">Final standing</h3>
        <HomeWorldDashboard game={game} />

        <p class="summary-hint">Screenshot this card to keep it — everything stays on your device.</p>
        {onNewGame && (
          <button class="primary big block" onClick={onNewGame}>
            Form a new government →
          </button>
        )}
      </div>
    </div>
  )
}
