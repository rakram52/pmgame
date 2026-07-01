import { useState } from 'preact/hooks'
import type { GameState } from '../state/schema'
import { downloadSave, exportJson } from '../persistence/store'
import { copyText } from './clipboard'

export function Settings({
  game,
  onCommit,
  onNewGame,
  onDelete,
}: {
  game: GameState
  onCommit: (g: GameState) => void
  onNewGame: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(game.pmName)
  const [copied, setCopied] = useState(false)

  function setModel(m: 'claude' | 'chatgpt' | 'other') {
    onCommit({ ...game, houseRules: { ...game.houseRules, modelProfile: m } })
  }
  function setBias(b: 'easy' | 'standard' | 'hard') {
    onCommit({ ...game, houseRules: { ...game.houseRules, difficultyBias: b } })
  }
  function saveName() {
    onCommit({ ...game, pmName: name.trim() || 'Prime Minister' })
  }

  async function copyFullSave() {
    const ok = await copyText(exportJson(game))
    setCopied(ok)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div class="settings screen-scroll">
      <h3 class="sec">Prime Minister</h3>
      <div class="rulerow">
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <button class="ghost" onClick={saveName}>
          Save
        </button>
      </div>

      <h3 class="sec">Narrating model</h3>
      <div class="seg wide">
        {(['claude', 'chatgpt', 'other'] as const).map((m) => (
          <button key={m} class={game.houseRules.modelProfile === m ? 'on' : ''} onClick={() => setModel(m)}>
            {m}
          </button>
        ))}
      </div>
      <p class="hint">"other" ships the format example every turn — use it for weaker models.</p>

      <h3 class="sec">Difficulty</h3>
      <div class="seg wide">
        {(['easy', 'standard', 'hard'] as const).map((b) => (
          <button key={b} class={game.houseRules.difficultyBias === b ? 'on' : ''} onClick={() => setBias(b)}>
            {b}
          </button>
        ))}
      </div>

      <h3 class="sec">Saves &amp; backup</h3>
      <p class="hint">
        Your game is saved on this device automatically every turn. Everything the game tracks lives here in the app — you can
        start a <strong>fresh chat</strong> with your model any time and lose nothing.
      </p>
      <div class="btn-col">
        <button class="ghost big" onClick={() => downloadSave(game)}>
          ⬇ Download save file
        </button>
        <button class="ghost big" onClick={copyFullSave}>
          {copied ? '✓ Copied' : '⧉ Copy full save (JSON)'}
        </button>
      </div>

      <h3 class="sec">Game</h3>
      <div class="btn-col">
        <button class="ghost big" onClick={onNewGame}>
          + Start a new game
        </button>
        <button class="danger big" onClick={onDelete}>
          Delete this game
        </button>
      </div>

      <p class="version">The Sovereign Game · save schema v{game.schemaVersion} · turn {game.turnIndex}</p>
    </div>
  )
}
