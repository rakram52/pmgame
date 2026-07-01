import { useState } from 'preact/hooks'
import { GREAT_OFFICES, INNER_MACHINE, SECOND_TIER_THEMES, DOCTRINE_DIALS, type OfficeChoice, type DoctrineChoice } from '../setup/content'
import { initGameState, type SetupSelections } from '../setup/init'
import type { GameState } from '../state/schema'

function defaults(offices: OfficeChoice[]): Record<string, string> {
  const o: Record<string, string> = {}
  for (const off of offices) o[off.key] = off.candidates[0].name
  return o
}

function OfficeSection({ office, value, onPick }: { office: OfficeChoice; value: string; onPick: (name: string) => void }) {
  return (
    <div class="setup-office">
      <h3>{office.role}</h3>
      <p class="stake">{office.stake}</p>
      <div class="cards">
        {office.candidates.map((c) => (
          <button key={c.name} class={`pick ${value === c.name ? 'sel' : ''}`} onClick={() => onPick(c.name)}>
            <div class="pick-top">
              <span class="pick-name">{c.name}</span>
              <span class={`faction f-${c.faction}`}>{c.faction}</span>
            </div>
            <div class="pick-blurb">{c.blurb}</div>
            <div class="pick-agenda">Agenda: {c.agenda}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function DoctrineSection({
  dial,
  value,
  directive,
  onPick,
  onDirective,
}: {
  dial: DoctrineChoice
  value: string
  directive: string
  onPick: (key: string) => void
  onDirective: (text: string) => void
}) {
  return (
    <div class="setup-office">
      <h3>{dial.title}</h3>
      {dial.note && <p class="stake">{dial.note}</p>}
      <div class="cards">
        {dial.options.map((o) => (
          <button key={o.key} class={`pick ${value === o.key ? 'sel' : ''}`} onClick={() => onPick(o.key)}>
            <div class="pick-top">
              <span class="pick-name">
                {o.key}) {o.label}
              </span>
            </div>
            <div class="pick-blurb">{o.detail}</div>
            <div class="pick-agenda">↑ {o.upside} · ↓ {o.downside}</div>
          </button>
        ))}
      </div>
      <label class="directive">
        <span class="directive-label">
          Your standing instruction <em>(optional)</em>
        </span>
        <textarea
          class="directive-input"
          placeholder="Your binding directive to officials on this brief — e.g. “No ECHR derogation without Cabinet sign-off; lead with returns deals, not detention.”"
          value={directive}
          onInput={(e) => onDirective((e.target as HTMLTextAreaElement).value)}
        />
      </label>
    </div>
  )
}

export function Setup({ onDone, onCancel }: { onDone: (g: GameState) => void; onCancel: () => void }) {
  const [pmName, setPmName] = useState('')
  const [offices, setOffices] = useState<Record<string, string>>(defaults(GREAT_OFFICES))
  const [innerMachine, setInnerMachine] = useState<Record<string, string>>(defaults(INNER_MACHINE))
  const [theme, setTheme] = useState('balance')
  const [doctrine, setDoctrine] = useState<Record<string, string>>(
    Object.fromEntries(DOCTRINE_DIALS.map((d) => [d.key, 'B'])),
  )
  const [doctrineDirectives, setDoctrineDirectives] = useState<Record<string, string>>({})
  const [difficultyBias, setDifficultyBias] = useState<'easy' | 'standard' | 'hard'>('standard')
  const [modelProfile, setModelProfile] = useState<'claude' | 'chatgpt' | 'other'>('claude')

  function form() {
    const sel: SetupSelections = { pmName, offices, innerMachine, secondTierTheme: theme, doctrine, doctrineDirectives, difficultyBias, modelProfile }
    onDone(initGameState(sel))
  }

  return (
    <div class="setup">
      <div class="setup-body">
        <div class="setup-head">
          <p class="cabsec">
            <em>Number 10. Starmer gone — a midnight letter, health cited, nobody buying it. Sir Edmund Hartley is at the
            desk with the folder. Let's get you a government before the markets open.</em>
          </p>
        </div>

        <label class="field">
          <span>Prime Minister's name (optional)</span>
          <input value={pmName} onInput={(e) => setPmName((e.target as HTMLInputElement).value)} placeholder="Prime Minister" />
        </label>

        <h2 class="setup-h2">The Great Offices</h2>
        {GREAT_OFFICES.map((o) => (
          <OfficeSection key={o.key} office={o} value={offices[o.key]} onPick={(n) => setOffices({ ...offices, [o.key]: n })} />
        ))}

        <h2 class="setup-h2">The Inner Machine</h2>
        {INNER_MACHINE.map((o) => (
          <OfficeSection key={o.key} office={o} value={innerMachine[o.key]} onPick={(n) => setInnerMachine({ ...innerMachine, [o.key]: n })} />
        ))}

        <h2 class="setup-h2">Second-tier Cabinet</h2>
        <div class="cards">
          {SECOND_TIER_THEMES.map((t) => (
            <button key={t.key} class={`pick ${theme === t.key ? 'sel' : ''}`} onClick={() => setTheme(t.key)}>
              <div class="pick-top">
                <span class="pick-name">{t.label}</span>
              </div>
              <div class="pick-blurb">{t.blurb}</div>
              <div class="pick-agenda">{t.ministers.map((m) => m.name).join(' · ')}</div>
            </button>
          ))}
        </div>

        <h2 class="setup-h2">Doctrine &amp; Policy Dials</h2>
        <p class="hint">
          Each pick locks a consequence that will fire somewhere in the first 10 weeks. Add your own instruction to any dial to
          steer how your government plays it — the narrator treats it as binding standing policy.
        </p>
        {DOCTRINE_DIALS.map((d) => (
          <DoctrineSection
            key={d.key}
            dial={d}
            value={doctrine[d.key]}
            directive={doctrineDirectives[d.key] ?? ''}
            onPick={(k) => setDoctrine({ ...doctrine, [d.key]: k })}
            onDirective={(text) => setDoctrineDirectives({ ...doctrineDirectives, [d.key]: text })}
          />
        ))}

        <h2 class="setup-h2">House rules</h2>
        <div class="rulerow">
          <span>Difficulty</span>
          <div class="seg">
            {(['easy', 'standard', 'hard'] as const).map((b) => (
              <button key={b} class={difficultyBias === b ? 'on' : ''} onClick={() => setDifficultyBias(b)}>
                {b}
              </button>
            ))}
          </div>
        </div>
        <div class="rulerow">
          <span>Narrating model</span>
          <div class="seg">
            {(['claude', 'chatgpt', 'other'] as const).map((b) => (
              <button key={b} class={modelProfile === b ? 'on' : ''} onClick={() => setModelProfile(b)}>
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div class="setup-bar">
        <button class="ghost" onClick={onCancel}>
          Cancel
        </button>
        <button class="primary big" onClick={form}>
          Form Government →
        </button>
      </div>
    </div>
  )
}
