import { useState, useEffect } from 'preact/hooks'
import type { GameState } from '../state/schema'
import { THREAT_LABELS } from '../state/schema'
import { chooseAction, applyReply, prepareAndBuild, type ApplyResult } from '../game/controller'
import { buildRepairPrompt } from '../prompt/repair'
import { copyText, readClipboard, chatUrl } from './clipboard'
import { RichText } from './richtext'

type Failure = Extract<ApplyResult, { ok: false }>['failure']

export function Play({ game, onCommit }: { game: GameState; onCommit: (g: GameState) => void }) {
  const [working, setWorking] = useState<GameState>(() => (game.options === null ? prepareAndBuild(game) : game))
  const [paste, setPaste] = useState('')
  const [error, setError] = useState<Failure | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [customText, setCustomText] = useState('')

  useEffect(() => {
    setWorking(game.options === null ? prepareAndBuild(game) : game)
    setPaste('')
    setError(null)
    setWarnings([])
    setCopied(false)
    setCustomText('')
  }, [game.gameId, game.turnIndex, game.currentScene])

  const opening = game.options === null
  const relaying = opening || working.chosenAction.trim().length > 0

  function pick(letter: 'A' | 'B' | 'C') {
    if (!game.options) return
    const risk = game.optionRisks?.[letter] ?? null
    setWorking(chooseAction(game, game.options[letter], risk))
    setError(null)
  }

  function sendCustom() {
    if (!customText.trim()) return
    setWorking(chooseAction(game, customText.trim(), null))
    setError(null)
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

  return (
    <div class="play screen-scroll">
      <div class="wk">
        <span class="wk-date">
          Week {game.calendar.week} · {formatDate(game.calendar.dateISO)}
        </span>
        <span class={`pill status-${game.status}`}>{game.status}</span>
      </div>
      <div class="wk-sub">
        {game.calendar.daysToLocals} days to locals · Approval {game.stateBlock.approval}% · Reform {game.stateBlock.reform}% · Threat {threat}
      </div>

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
            <strong>The game begins.</strong> Relay the opening below to {game.houseRules.modelProfile === 'chatgpt' ? 'ChatGPT' : 'Claude'} to
            set the first scene.
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

      {!relaying && game.options && (
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
              placeholder="…or give your own instruction (e.g. 'Summon the Chancellor and the Cab Sec; I want options on the ECHR by Friday')."
              value={customText}
              onInput={(e) => setCustomText((e.target as HTMLTextAreaElement).value)}
            />
            <button class="ghost" onClick={sendCustom} disabled={!customText.trim()}>
              Send instruction
            </button>
          </div>
        </div>
      )}

      {relaying && (
        <div class="relay">
          {!opening && (
            <div class="chosen">
              <span class="chosen-label">Your decision</span>
              <span class="chosen-text">{working.chosenAction}</span>
              <button class="link" onClick={() => setWorking(game)}>
                change
              </button>
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
                placeholder="Paste the whole reply from Claude (prose + the DELTA block)…"
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
      )}
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
