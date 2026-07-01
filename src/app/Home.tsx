import { useEffect, useState } from 'preact/hooks'
import { listGames, loadGame, importJson, type GameSummary } from '../persistence/store'
import type { GameState } from '../state/schema'

export function Home({ onNew, onOpen }: { onNew: () => void; onOpen: (g: GameState) => void }) {
  const [games, setGames] = useState<GameSummary[]>([])
  const [importError, setImportError] = useState('')

  useEffect(() => {
    listGames().then(setGames)
  }, [])

  async function open(id: string) {
    const g = await loadGame(id)
    if (g) onOpen(g)
  }

  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      onOpen(importJson(text))
    } catch (err) {
      setImportError((err as Error).message)
    }
  }

  return (
    <div class="home screen-scroll">
      <div class="home-hero">
        <h1>The Sovereign Game</h1>
        <p class="tagline">You are the Prime Minister. The state is around you. Everything is tracked in code — so it never drifts.</p>
      </div>

      <button class="primary big block" onClick={onNew}>
        New game
      </button>

      {games.length > 0 && (
        <>
          <h3 class="sec">Continue</h3>
          <ul class="save-list">
            {games.map((g) => (
              <li key={g.gameId}>
                <button onClick={() => open(g.gameId)}>
                  <span class="save-name">{g.pmName}</span>
                  <span class="save-meta">
                    Week {g.week} · {g.status} · {new Date(g.updatedAt).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 class="sec">Import a save</h3>
      <label class="import-btn big ghost">
        ⬆ Load save file
        <input type="file" accept="application/json,.json" onChange={onFile} hidden />
      </label>
      {importError && <p class="err-body">{importError}</p>}
    </div>
  )
}
