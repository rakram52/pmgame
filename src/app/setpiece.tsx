import type { GameState, TurnKind, ActiveScene } from '../state/schema'
import { TURN_KIND_META } from '../engine/turnKinds'
import { CAPITAL_LEADERS } from '../game/links'
import { Portrait } from './portrait'

/** A little row of pips showing how far through a multi-beat encounter we are. */
export function BeatDots({ scene }: { scene: ActiveScene }) {
  if (scene.maxBeats <= 1) return null
  return (
    <span class="sp-beats" role="img" aria-label={`Beat ${scene.beat} of ${scene.maxBeats}`}>
      {Array.from({ length: scene.maxBeats }, (_, i) => (
        <span key={i} class={`sp-beat ${i < scene.beat ? 'on' : ''}`} />
      ))}
    </span>
  )
}

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
      {game.activeScene && <BeatDots scene={game.activeScene} />}
    </div>
  )
}

/** A lightweight banner for a live 1:1 encounter on an ordinary week (no
 *  set-piece chip). Shows who's in the room and how far through the exchange. */
export function EncounterBanner({ scene }: { scene: ActiveScene }) {
  if (scene.maxBeats <= 1) return null
  return (
    <div class="sp-banner sp-encounter" role="note">
      <div class="sp-banner-main">
        <span class="sp-banner-kind">In the room</span>
        <span class="sp-banner-title">{scene.focus ? `Face to face — ${scene.focus}` : 'A conversation that matters'}</span>
      </div>
      <BeatDots scene={scene} />
    </div>
  )
}

