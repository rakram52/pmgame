import { useState } from 'preact/hooks'
import type { GameState } from '../state/schema'
import type { Connection } from '../llm/types'
import { PRESETS, presetById } from '../llm/presets'
import { testConnection } from '../llm/client'
import { downloadSave, exportJson } from '../persistence/store'
import { copyText } from './clipboard'

export function Settings({
  game,
  onCommit,
  onNewGame,
  onDelete,
  connection,
  onConnectionChange,
}: {
  game: GameState
  onCommit: (g: GameState) => void
  onNewGame: () => void
  onDelete: () => void
  connection: Connection | null
  onConnectionChange: (c: Connection) => void
}) {
  const [name, setName] = useState(game.pmName)
  const [copied, setCopied] = useState(false)

  // Connection form
  const initialPreset = connection?.presetId ?? 'openrouter'
  const [presetId, setPresetId] = useState(initialPreset)
  const [baseUrl, setBaseUrl] = useState(connection?.baseUrl ?? presetById(initialPreset)?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(connection?.apiKey ?? '')
  const [model, setModel] = useState(connection?.model ?? presetById(initialPreset)?.defaultModel ?? '')
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const preset = presetById(presetId)!

  function choosePreset(id: string) {
    const p = presetById(id)!
    setPresetId(id)
    if (!p.editableBaseUrl) setBaseUrl(p.baseUrl)
    else if (!baseUrl) setBaseUrl(p.baseUrl)
    setModel(p.defaultModel)
    setTestMsg(null)
  }

  function buildConn(enabled: boolean): Connection {
    return { apiType: preset.apiType, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), model: model.trim(), enabled, presetId }
  }

  async function test() {
    setTesting(true)
    setTestMsg(null)
    const r = await testConnection(buildConn(true))
    setTesting(false)
    setTestMsg({ ok: r.ok, text: r.message })
  }

  const enabled = connection?.enabled === true

  function setModelPref(m: 'claude' | 'chatgpt' | 'other') {
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
      <h3 class="sec">Connection — one-tap play</h3>
      <p class="hint">
        Connect a model and turns become one tap — no copy-paste. Leave it off to keep the manual relay. Your key is stored only
        on this device and is <strong>never</strong> included in exported saves.
      </p>

      {enabled && <div class="conn-badge">● One-tap ON — {preset.label} · {connection?.model}</div>}

      <label class="field">
        <span>Provider</span>
        <select value={presetId} onChange={(e) => choosePreset((e.target as HTMLSelectElement).value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <p class="hint">{preset.note}</p>

      {preset.editableBaseUrl && (
        <label class="field">
          <span>Base URL</span>
          <input value={baseUrl} onInput={(e) => setBaseUrl((e.target as HTMLInputElement).value)} placeholder="https://…/v1" />
        </label>
      )}

      {preset.id !== 'ollama' && (
        <label class="field">
          <span>
            API key{' '}
            {preset.keyUrl && (
              <a href={preset.keyUrl} target="_blank" rel="noreferrer" class="link-inline">
                get one ↗
              </a>
            )}
          </span>
          <input type="password" value={apiKey} onInput={(e) => setApiKey((e.target as HTMLInputElement).value)} placeholder="sk-…" />
        </label>
      )}

      <label class="field">
        <span>Model</span>
        <input value={model} onInput={(e) => setModel((e.target as HTMLInputElement).value)} placeholder="model id" />
      </label>

      <div class="btn-row">
        <button class="ghost" onClick={test} disabled={testing || !baseUrl || !model}>
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {enabled ? (
          <button class="ghost" onClick={() => onConnectionChange(buildConn(false))}>
            Turn off
          </button>
        ) : (
          <button class="primary" onClick={() => onConnectionChange(buildConn(true))} disabled={!baseUrl || !model || (preset.id !== 'ollama' && !apiKey)}>
            Enable one-tap
          </button>
        )}
      </div>
      {enabled && (
        <div class="btn-row">
          <button class="primary" onClick={() => onConnectionChange(buildConn(true))} disabled={!baseUrl || !model}>
            Save changes
          </button>
        </div>
      )}
      {testMsg && <p class={testMsg.ok ? 'test-ok' : 'test-bad'}>{testMsg.ok ? '✓ ' : '✗ '}{testMsg.text}</p>}

      <h3 class="sec">Prime Minister</h3>
      <div class="rulerow">
        <input value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <button class="ghost" onClick={saveName}>
          Save
        </button>
      </div>

      <h3 class="sec">Copy-paste model (when one-tap is off)</h3>
      <div class="seg wide">
        {(['claude', 'chatgpt', 'other'] as const).map((m) => (
          <button key={m} class={game.houseRules.modelProfile === m ? 'on' : ''} onClick={() => setModelPref(m)}>
            {m}
          </button>
        ))}
      </div>

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
        Saved on this device every turn. All tracked state lives in the app — start a fresh chat any time and lose nothing.
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
