import { useState } from 'preact/hooks'
import type { GameState, TurnKind } from '../state/schema'
import { TURN_KIND_META, initiableTurnKinds } from '../engine/turnKinds'
import { CAPITAL_LEADERS } from '../game/links'
import { Portrait } from './portrait'

/** The set-piece title shown in the banner (surfaces the capital for a summit). */
function setpieceTitle(game: GameState): string {
  const meta = TURN_KIND_META[game.turnKind]
  if (game.turnKind === 'summit' && game.setpieceContext) {
    const leader = CAPITAL_LEADERS[game.setpieceContext]
    return `${game.setpieceContext}${leader ? ` · ${leader}` : ''}`
  }
  if (game.turnKind === 'cobra' && game.setpieceContext && game.setpieceContext !== 'Security') {
    return game.setpieceContext
  }
  return meta.banner
}

/** Small labelled chip for the HUD header (US-105). Nothing on standard weeks. */
export function SetpieceChip({ kind }: { kind: TurnKind }) {
  if (kind === 'standard') return null
  return <span class={`sp-chip sp-${kind}`}>{TURN_KIND_META[kind].label}</span>
}

/** The set-piece banner above the scene (US-103 / US-104 / US-202). Full
 *  cinematic styling lands in US-403; a clear per-kind visual state ships here. */
export function SetpieceBanner({ game }: { game: GameState }) {
  if (game.turnKind === 'standard') return null
  const meta = TURN_KIND_META[game.turnKind]
  const leader = game.turnKind === 'summit' && game.setpieceContext ? CAPITAL_LEADERS[game.setpieceContext] : null
  return (
    <div class={`sp-banner sp-${game.turnKind}`} role="note">
      {leader && <Portrait seed={`summit-${game.setpieceContext}`} label={leader} color="#8fa3c9" size={38} />}
      <div class="sp-banner-main">
        <span class="sp-banner-kind">{meta.label}</span>
        <span class="sp-banner-title">{setpieceTitle(game)}</span>
      </div>
    </div>
  )
}

/** The "PM actions" affordance (US-106): queue an eligible set-piece for the
 *  next turn. `onQueue(null)` cancels a pending queue. */
export function PmActions({ game, onQueue }: { game: GameState; onQueue: (kind: TurnKind | null) => void }) {
  const [open, setOpen] = useState(false)
  const options = initiableTurnKinds(game)
  const queued = game.queuedTurnKind && game.queuedTurnKind !== 'standard' ? game.queuedTurnKind : null

  return (
    <div class="pm-actions">
      <button class="ghost pm-actions-btn" onClick={() => setOpen((o) => !o)}>
        ⋯ PM actions
      </button>

      {queued && (
        <div class="queued-note">
          <span>
            Next week: <strong>{TURN_KIND_META[queued].label}</strong> queued
          </span>
          <button class="link" onClick={() => onQueue(null)}>
            cancel
          </button>
        </div>
      )}

      {open && (
        <div class="pm-sheet">
          <div class="pm-sheet-head">Convene a set-piece next week</div>
          {options.map((k) => (
            <button key={k} class={`pm-sheet-item ${queued === k ? 'sel' : ''}`} onClick={() => { onQueue(k); setOpen(false) }}>
              <span class={`sp-chip sp-${k}`}>{TURN_KIND_META[k].label}</span>
              <span class="pm-sheet-blurb">{TURN_KIND_META[k].blurb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
