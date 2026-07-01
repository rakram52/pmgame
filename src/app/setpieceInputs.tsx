import { useState } from 'preact/hooks'
import type { GameState, Risk, CastMember } from '../state/schema'
import { computeHeadroom, assessBudget } from '../engine/setpieceLogic'
import { signed } from './meters'
import { Portrait, castColor } from './portrait'

export type SetpieceConfirm = (action: string, risk: Risk, injections: string[]) => void

// ---------------------------------------------------------------------------
// Budget / fiscal event (US-201) — allocate headroom with phone-friendly steppers
// ---------------------------------------------------------------------------

const LEVERS = [
  { key: 'nhs', label: 'NHS & care' },
  { key: 'costOfLiving', label: 'Cost of living' },
  { key: 'defence', label: 'Defence' },
  { key: 'housing', label: 'Housing & infra' },
  { key: 'taxCuts', label: 'Tax cuts' },
  { key: 'reserve', label: 'Rebuild headroom' },
]
const STEP = 2
const MAX_PER = 24

export function BudgetSheet({ game, onConfirm, busy }: { game: GameState; onConfirm: SetpieceConfirm; busy: boolean }) {
  const headroom = computeHeadroom(game)
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries(LEVERS.map((l) => [l.key, 0])))
  const total = Object.values(alloc).reduce((a, b) => a + b, 0)
  const assessment = assessBudget(headroom, total)
  const pct = Math.min(100, headroom > 0 ? (total / headroom) * 100 : total > 0 ? 100 : 0)
  const over = total > headroom

  function bump(key: string, d: number) {
    setAlloc((a) => ({ ...a, [key]: Math.max(0, Math.min(MAX_PER, a[key] + d)) }))
  }

  function confirm() {
    const parts = LEVERS.filter((l) => alloc[l.key] > 0).map((l) => `${l.label} +£${alloc[l.key]}bn`)
    const desc = parts.length ? parts.join(', ') : 'a standstill Budget (no new commitments)'
    const action = `BUDGET — the PM's package: ${desc}. Total £${total}bn committed against £${headroom}bn of fiscal headroom.`
    const risk: Risk = assessment.ratio > 1.5 ? 'desperate' : assessment.overcommitted ? 'hard' : assessment.undercommitted ? 'easy' : 'moderate'
    onConfirm(action, risk, [assessment.injection])
  }

  return (
    <div class="sp-input budget-input">
      <div class="sp-input-head">
        <span class="sp-input-title">Allocate the Budget</span>
        <span class={`headroom-tag ${over ? 'over' : ''}`}>
          £{total}bn / £{headroom}bn headroom
        </span>
      </div>
      <div class="headroom-bar">
        <div class={`headroom-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <p class={`headroom-note ${over ? 'over' : ''}`}>
        {over ? `Over headroom by £${total - headroom}bn — markets will notice.` : assessment.undercommitted ? 'A cautious book — credible, but the base will grumble.' : 'Within the envelope.'}
      </p>

      <div class="levers">
        {LEVERS.map((l) => (
          <div key={l.key} class="lever">
            <span class="lever-label">{l.label}</span>
            <div class="stepper">
              <button class="step-btn" onClick={() => bump(l.key, -STEP)} disabled={alloc[l.key] === 0} aria-label={`less ${l.label}`}>
                −
              </button>
              <span class="lever-val">£{alloc[l.key]}bn</span>
              <button class="step-btn" onClick={() => bump(l.key, STEP)} disabled={alloc[l.key] >= MAX_PER} aria-label={`more ${l.label}`}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <button class="primary big block" onClick={confirm} disabled={busy}>
        Deliver the Budget →
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cabinet reshuffle (US-203) — intent-led personnel moves, model casts within
// faction constraints
// ---------------------------------------------------------------------------

type Move = 'keep' | 'promote' | 'move' | 'sack'
const MOVE_ORDER: Move[] = ['keep', 'promote', 'move', 'sack']
const MOVE_LABEL: Record<Move, string> = { keep: 'Keep', promote: 'Promote', move: 'Move', sack: 'Sack' }

function standingTone(s: number): string {
  return s < 0 ? 'neg' : s > 30 ? 'pos' : ''
}

export function ReshuffleSheet({ game, onConfirm, busy }: { game: GameState; onConfirm: SetpieceConfirm; busy: boolean }) {
  const [moves, setMoves] = useState<Record<string, Move>>({})
  const cabinet = game.cabinet

  function cycle(id: string) {
    setMoves((m) => {
      const cur = m[id] ?? 'keep'
      const next = MOVE_ORDER[(MOVE_ORDER.indexOf(cur) + 1) % MOVE_ORDER.length]
      return { ...m, [id]: next }
    })
  }

  const changes = cabinet.filter((c) => (moves[c.id] ?? 'keep') !== 'keep')
  const sacks = changes.filter((c) => moves[c.id] === 'sack').length

  function confirm() {
    const desc = changes.map((c) => `${MOVE_LABEL[moves[c.id]]} ${c.name} (${c.role})`).join('; ')
    const body = desc || 'no changes — a reshuffle that reshuffles nothing, which is a story in itself'
    const action =
      `RESHUFFLE — the PM's moves: ${body}. Narrate the fallout and return a cabinet delta (update / remove / add): ` +
      `the promoted rise in standing, the snubbed and the sacked fall (a sacking can begin to plot). Cast any replacements within faction constraints.`
    const risk: Risk = sacks >= 4 ? 'desperate' : sacks >= 2 ? 'hard' : 'moderate'
    onConfirm(action, risk, [])
  }

  return (
    <div class="sp-input reshuffle-input">
      <div class="sp-input-head">
        <span class="sp-input-title">Reshape the Cabinet</span>
        <span class="reshuffle-count">{changes.length} move{changes.length === 1 ? '' : 's'}</span>
      </div>
      <p class="reshuffle-hint">Tap a minister to cycle Keep → Promote → Move → Sack.</p>

      <ul class="reshuffle-list">
        {cabinet.map((m: CastMember) => {
          const mv = moves[m.id] ?? 'keep'
          return (
            <li key={m.id} class={`reshuffle-row mv-${mv}`}>
              <Portrait seed={m.id + m.name} label={m.name} color={castColor(m.faction)} size={30} />
              <div class="reshuffle-who">
                <span class="reshuffle-name">{m.name}</span>
                <span class="reshuffle-role">{m.role}</span>
              </div>
              <span class={`standing-tag ${standingTone(m.standing)}`}>{signed(m.standing)}</span>
              <button class={`move-btn move-${mv}`} onClick={() => cycle(m.id)}>
                {MOVE_LABEL[mv]}
              </button>
            </li>
          )
        })}
      </ul>

      <button class="primary big block" onClick={confirm} disabled={busy}>
        {changes.length ? 'Carry out the reshuffle →' : 'Leave the Cabinet unchanged →'}
      </button>
    </div>
  )
}
