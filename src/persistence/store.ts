import { get, set, del, keys } from 'idb-keyval'
import type { GameState } from '../state/schema'
import { migrate } from '../state/migrations'
import type { Connection } from '../llm/types'
import { healConnection } from '../llm/presets'

/**
 * Local-first durable persistence. IndexedDB is the primary store; export/import
 * JSON files are the backup and cross-device path. No server, no accounts.
 */

const GAME_PREFIX = 'game:'
const LAST_ACTIVE = 'lastActive'
const CONNECTION_KEY = 'llmConnection'

export interface GameSummary {
  gameId: string
  pmName: string
  week: number
  status: string
  updatedAt: string
}

function nowISO(): string {
  return new Date().toISOString()
}

/** Stamp timestamps (kept out of the pure reducer) and persist. */
export async function saveGame(state: GameState): Promise<GameState> {
  const stamped: GameState = {
    ...state,
    createdAt: state.createdAt || nowISO(),
    updatedAt: nowISO(),
  }
  await set(GAME_PREFIX + stamped.gameId, stamped)
  await set(LAST_ACTIVE, stamped.gameId)
  return stamped
}

export async function loadGame(gameId: string): Promise<GameState | null> {
  const raw = await get(GAME_PREFIX + gameId)
  return raw ? migrate(raw) : null
}

export async function loadLastActive(): Promise<GameState | null> {
  const id = await get<string>(LAST_ACTIVE)
  return id ? loadGame(id) : null
}

export async function listGames(): Promise<GameSummary[]> {
  const allKeys = (await keys()) as string[]
  const gameKeys = allKeys.filter((k) => typeof k === 'string' && k.startsWith(GAME_PREFIX))
  const out: GameSummary[] = []
  for (const k of gameKeys) {
    try {
      const g = migrate(await get(k))
      out.push({ gameId: g.gameId, pmName: g.pmName, week: g.calendar.week, status: g.status, updatedAt: g.updatedAt })
    } catch {
      // skip corrupt/incompatible saves in the list
    }
  }
  return out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function deleteGame(gameId: string): Promise<void> {
  await del(GAME_PREFIX + gameId)
  const last = await get<string>(LAST_ACTIVE)
  if (last === gameId) await del(LAST_ACTIVE)
}

export async function setLastActive(gameId: string): Promise<void> {
  await set(LAST_ACTIVE, gameId)
}

// --- LLM connection (device-local; NEVER part of an exported save) ----------

export async function saveConnection(conn: Connection): Promise<void> {
  await set(CONNECTION_KEY, conn)
}

export async function loadConnection(): Promise<Connection | null> {
  const stored = (await get<Connection>(CONNECTION_KEY)) ?? null
  const healed = healConnection(stored)
  // Persist the heal so it survives, and so Settings shows the live model.
  if (healed && healed !== stored) await set(CONNECTION_KEY, healed)
  return healed
}

export async function clearConnection(): Promise<void> {
  await del(CONNECTION_KEY)
}

// --- Export / import --------------------------------------------------------

export function exportJson(state: GameState): string {
  return JSON.stringify(state, null, 2)
}

export function importJson(text: string): GameState {
  const raw = JSON.parse(text)
  return migrate(raw)
}

/** Trigger a browser download of the save (backup / share). */
export function downloadSave(state: GameState): void {
  const blob = new Blob([exportJson(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sovereign-${state.pmName.replace(/\s+/g, '-').toLowerCase()}-w${state.calendar.week}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
