import { useState } from 'preact/hooks'
import type { GameState, Risk } from '../state/schema'
import { computeHeadroom, assessBudget } from '../engine/setpieceLogic'

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
