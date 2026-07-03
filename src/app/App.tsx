import { useEffect, useState } from 'preact/hooks'
import type { GameState } from '../state/schema'
import type { Connection } from '../llm/types'
import { loadLastActive, saveGame, deleteGame, setLastActive, downloadSave, loadConnection, saveConnection } from '../persistence/store'
import { Home } from './Home'
import { Setup } from './Setup'
import { Play } from './Play'
import { Dossier } from './Dossier'
import { StatePanel } from './StatePanel'
import { Settings } from './Settings'
import { isLoopDue } from '../prompt/builder'

type Screen = 'loading' | 'home' | 'setup' | 'game'
type Tab = 'play' | 'dossier' | 'state' | 'settings'

const BACKUP_EVERY = 10

export function App() {
  const [game, setGame] = useState<GameState | null>(null)
  const [screen, setScreen] = useState<Screen>('loading')
  const [tab, setTab] = useState<Tab>('play')
  const [connection, setConnection] = useState<Connection | null>(null)

  useEffect(() => {
    loadConnection().then(setConnection)
    loadLastActive().then((g) => {
      if (g) {
        setGame(g)
        setScreen('game')
      } else {
        setScreen('home')
      }
    })
  }, [])

  async function updateConnection(conn: Connection) {
    await saveConnection(conn)
    setConnection(conn)
  }

  async function commit(next: GameState) {
    const prevTurn = game?.turnIndex ?? 0
    const stamped = await saveGame(next)
    setGame(stamped)
    // Rolling backup: one auto-download whenever we cross a 10-turn boundary.
    if (Math.floor(stamped.turnIndex / BACKUP_EVERY) > Math.floor(prevTurn / BACKUP_EVERY) && stamped.turnIndex >= BACKUP_EVERY) {
      try {
        downloadSave(stamped)
      } catch {
        /* ignore — backup is best-effort */
      }
    }
  }

  async function openGame(g: GameState) {
    const stamped = await saveGame(g)
    await setLastActive(stamped.gameId)
    setGame(stamped)
    setTab('play')
    setScreen('game')
  }

  async function onDelete() {
    if (!game) return
    if (!confirm('Delete this game permanently? Export a save first if you want to keep it.')) return
    await deleteGame(game.gameId)
    setGame(null)
    setScreen('home')
  }

  if (screen === 'loading') return <div class="splash">…</div>
  if (screen === 'home') return <Home onNew={() => setScreen('setup')} onOpen={openGame} />
  if (screen === 'setup') return <Setup onDone={openGame} onCancel={() => setScreen(game ? 'game' : 'home')} />
  if (!game) return <Home onNew={() => setScreen('setup')} onOpen={openGame} />

  const dueCount = game.openLoops.filter((l) => isLoopDue(l, game.calendar.week)).length

  return (
    <div class="app">
      <main class="content">
        {/* Play stays mounted across tab switches (hidden, not unmounted) so an
            in-flight scene request survives navigation and any half-typed
            instruction/reply isn't lost. */}
        <div class={tab === 'play' ? 'tabpane' : 'tabpane hidden'} aria-hidden={tab === 'play' ? undefined : 'true'}>
          <Play game={game} connection={connection} onCommit={commit} onNewGame={() => setScreen('setup')} />
        </div>
        {tab === 'dossier' && <Dossier game={game} />}
        {tab === 'state' && <StatePanel game={game} />}
        {tab === 'settings' && (
          <Settings
            game={game}
            onCommit={commit}
            onNewGame={() => setScreen('setup')}
            onDelete={onDelete}
            connection={connection}
            onConnectionChange={updateConnection}
          />
        )}
      </main>
      <nav class="tabs">
        <button class={tab === 'play' ? 'on' : ''} onClick={() => setTab('play')}>
          <span class="tab-ico">▶</span>Play
        </button>
        <button class={tab === 'dossier' ? 'on' : ''} onClick={() => setTab('dossier')}>
          <span class="tab-ico">▤</span>Dossier
          {dueCount > 0 && <span class="tab-badge">{dueCount}</span>}
        </button>
        <button class={tab === 'state' ? 'on' : ''} onClick={() => setTab('state')}>
          <span class="tab-ico">◉</span>State
        </button>
        <button class={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}>
          <span class="tab-ico">⚙</span>Menu
        </button>
      </nav>
    </div>
  )
}
