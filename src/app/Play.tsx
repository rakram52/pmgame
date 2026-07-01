import { useState, useEffect, useRef } from 'preact/hooks'
import type { GameState } from '../state/schema'
import { THREAT_LABELS } from '../state/schema'
import type { Connection } from '../llm/types'
import { chooseAction, applyReply, prepareAndBuild, runTurnAuto, type ApplyResult } from '../game/controller'
import { buildRepairPrompt } from '../prompt/repair'
import { copyText, readClipboard, chatUrl } from './clipboard'
import { RichText } from './richtext'
import { Gauge, ThreatPips, approvalTone, threatTone } from './meters'

type Failure = Extract<ApplyResult, { ok: false }>['failure']

export function Play({ game, connection, onCommit }: { game: GameState; connection: Connection | null; onCommit: (g: GameState) => void }) {
  const [working, setWorking] = useState<GameState>(() => (game.options === null ? prepareAndBuild(game) : game))
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<Failure | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [customText, setCustomText] = useState('')
  const [autoBusy, setAutoBusy] = useState(false)
  const [autoError, setAutoError] = useState<string | null>(null)
  const [forceManual, setForceManual] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const autoMode = connection?.enabled === true
  const opening = game.options === null

  useEffect(() => {
    setWorking(game.options === null ? prepareAndBuild(game) : game)
    setPaste('')
    setError(null)
    setWarnings([])
    setCopied(false)
    setCustomText('')
    setAutoError(null)
    setForceManual(false)
  }, [game.gameId, game.turnIndex, game.currentScene])

  useEffect(() => () => abortRef.current?.abort(), [])

  async function runAuto(target: GameState) {
    if (!connection) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setAutoBusy(true)
    setAutoError(null)
    const res = await runTurnAuto(target, connection, ac.signal)
    if (ac.signal.aborted) return
    setAutoBusy(false)
    if (res.ok) {
      setWarnings(res.warnings)
      onCommit(res.state)
    } else {
      setAutoError(res.error)
    }
  }

  function act(action: string, risk: Parameters<typeof chooseAction>[2]) {
    const acted = chooseAction(game, action, risk)
    setWorking(acted)
    setError(null)
    if (autoMode && !forceManual) runAuto(acted)
  }

  function pick(letter: 'A' | 'B' | 'C') {
    if (!game.options) return
    act(game.options[letter], game.optionRisks?.[letter] ?? null)
  }

  function sendCustom() {
    if (!customText.trim()) return
    act(customText.trim(), null)
  }

  async function doCopy() {
    const ok = await copyText(working.lastPrompt)
    setCopied(ok)
    setTimeout(() => setCopied(false), 1800)
  }

  async function pasteFromClipboard() {
    const t = await readClipboard()
    if (t) setPaste(t)
  }

  function apply() {
    const res = applyReply(working, paste)
    if (!res.ok) {
      setError(res.failure)
      return
    }
    setWarnings(res.warnings)
    onCommit(res.state)
  }

  async function copyRepair() {
    if (!error) return
    await copyText(buildRepairPrompt(error))
  }

  const threat = THREAT_LABELS[Math.round(game.stateBlock.threat) - 1] ?? game.stateBlock.threat
  const pendingPrompt = opening || working.chosenAction.trim().length > 0
  const useManual = !autoMode || forceManual
  const modelName = connection?.model || (game.houseRules.modelProfile === 'chatgpt' ? 'ChatGPT' : 'Claude')

  return (
    <div class="play">
      <header class="play-hud">
        <div class="wk">
          <span class="wk-date">
            Week {game.calendar.week} · {formatDate(game.calendar.dateISO)}
          </span>
          <span class={`pill status-${game.status}`}>{game.status}</span>
        </div>
        <div class="hud-meters">
          <div class="hud-meter">
            <div class="hud-meter-top">
              <span class="hud-label">Approval</span>
              <span class="hud-num">{game.stateBlock.approval}%</span>
            </div>
            <Gauge value={game.stateBlock.approval} tone={approvalTone(game.stateBlock.approval)} />
          </div>
          <div class="hud-meter">
            <div class="hud-meter-top">
              <span class="hud-label">Reform UK</span>
              <span class="hud-num">{game.stateBlock.reform}%</span>
            </div>
            <Gauge value={game.stateBlock.reform} max={50} tone={threatTone(game.stateBlock.reform, 26, 32)} />
          </div>
          <div class="hud-meter">
            <div class="hud-meter-top">
              <span class="hud-label">Threat</span>
              <span class="hud-num">{threat}</span>
            </div>
            <ThreatPips level={game.stateBlock.threat} />
          </div>
        </div>
        <div class="wk-sub">
          {game.calendar.daysToLocals} days to locals · Capital {game.stateBlock.capital}/100 · Whip {game.stateBlock.whip >= 0 ? `+${game.stateBlock.whip}` : game.stateBlock.whip}
        </div>
      </header>

      <div class="play-body">
      {game.status === 'lost' && (
        <div class="lost-banner">The government has fallen. Review the dossier, or start anew from the menu.</div>
      )}

      {game.currentScene ? (
        <div class="scene">
          <RichText text={game.currentScene} />
        </div>
      ) : (
        <div class="scene opening-note">
          <p>
            <strong>The game begins.</strong>{' '}
            {autoMode ? `Tap Begin to have ${modelName} set the first scene.` : `Relay the opening below to ${modelName} to set the first scene.`}
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div class="warns">
          {warnings.map((w, i) => (
            <div key={i} class="warn">
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* ---- Action area ---- */}
      {autoBusy ? (
        <div class="thinking">
          <span class="spinner" /> {modelName} is writing the scene…
        </div>
      ) : autoError && !forceManual ? (
        <div class="err">
          <div class="err-title">Couldn't reach the model</div>
          <div class="err-body">{autoError}</div>
          <div class="err-actions">
            <button class="primary" onClick={() => runAuto(working)}>
              Retry
            </button>
            <button class="ghost" onClick={() => setForceManual(true)}>
              Use copy-paste for this turn
            </button>
          </div>
        </div>
      ) : useManual && pendingPrompt ? (
        <div class="relay">
          {!opening && (
            <div class="chosen">
              <span class="chosen-label">Your decision</span>
              <span class="chosen-text">{working.chosenAction}</span>
              {!forceManual && (
                <button class="link" onClick={() => setWorking(game)}>
                  change
                </button>
              )}
            </div>
          )}
          <div class="relay-step">
            <div class="step-n">1</div>
            <div class="step-body">
              <div class="step-title">Copy the turn, paste it into your chat</div>
              <div class="relay-btns">
                <button class="primary big" onClick={doCopy}>
                  {copied ? '✓ Copied' : 'Copy turn prompt'}
                </button>
                <a class="ghost big" href={chatUrl(game.houseRules.modelProfile)} target="_blank" rel="noreferrer">
                  Open {game.houseRules.modelProfile === 'chatgpt' ? 'ChatGPT' : 'Claude'} ↗
                </a>
              </div>
              <button class="link" onClick={() => setShowPrompt((v) => !v)}>
                {showPrompt ? 'Hide' : 'Preview'} prompt ({working.lastPrompt.length.toLocaleString()} chars)
              </button>
              {showPrompt && <pre class="prompt-preview">{working.lastPrompt}</pre>}
            </div>
          </div>
          <div class="relay-step">
            <div class="step-n">2</div>
            <div class="step-body">
              <div class="step-title">Paste the reply back here</div>
              <textarea
                class="paste"
                placeholder="Paste the whole reply (prose + the DELTA block)…"
                value={paste}
                onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
              />
              <div class="relay-btns">
                <button class="ghost" onClick={pasteFromClipboard}>
                  Paste from clipboard
                </button>
                <button class="primary big" onClick={apply} disabled={!paste.trim()}>
                  Apply reply →
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div class="err">
              <div class="err-title">Couldn't apply that reply</div>
              <div class="err-body">{error.error}</div>
              <div class="err-actions">
                <button class="primary" onClick={copyRepair}>
                  Copy repair prompt
                </button>
                <span class="err-hint">Paste it into the same chat, then paste the corrected reply above.</span>
              </div>
            </div>
          )}
        </div>
      ) : opening ? (
        <div class="choices">
          <button class="primary big block" onClick={() => runAuto(game)}>
            Begin ▶
          </button>
        </div>
      ) : (
        game.options && (
          <div class="choices">
            {(['A', 'B', 'C'] as const).map((k) => (
              <button key={k} class="option" onClick={() => pick(k)}>
                <span class="opt-letter">{k}</span>
                <span class="opt-text">{game.options![k]}</span>
                {game.optionRisks && <span class={`risk r-${game.optionRisks[k]}`}>{game.optionRisks[k]}</span>}
              </button>
            ))}
            <div class="custom">
              <textarea
                placeholder="…or give your own instruction (e.g. 'Summon the Chancellor; I want ECHR options by Friday')."
                value={customText}
                onInput={(e) => setCustomText((e.target as HTMLTextAreaElement).value)}
              />
              <button class="ghost" onClick={sendCustom} disabled={!customText.trim()}>
                Send instruction
              </button>
            </div>
          </div>
        )
      )}
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00Z')
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  } catch {
    return iso
  }
}
