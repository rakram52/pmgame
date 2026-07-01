import type { GameState } from '../state/schema'
import { DOCTRINE_KEYS, THREAT_LABELS, TERMINAL_LOOP_STATUSES } from '../state/schema'
import { RULES_CORE, OUTPUT_CONTRACT_CHAT, OUTPUT_CONTRACT_API } from './systemRules'
import { FEW_SHOT } from './fewshot'

export type PromptMode = 'chat' | 'api'

/** Is a loop live and due (its week has arrived and it isn't terminal)? */
export function isLoopDue(loop: GameState['openLoops'][number], week: number): boolean {
  return !TERMINAL_LOOP_STATUSES.includes(loop.status) && loop.dueWeek <= week
}

const DOCTRINE_LABELS: Record<(typeof DOCTRINE_KEYS)[number], string> = {
  immigration: 'Immigration & asylum',
  economy: 'Economy & fiscal',
  nhs: 'NHS & public services',
  costOfLiving: 'Cost of living & energy',
  crime: 'Crime & justice',
  housing: 'Housing & planning',
  atlanticEurope: 'Atlantic / Europe posture',
  defence: 'Defence & security',
  reformStrategy: 'Strategy vs Reform UK',
}

/** Compact, human-readable state snapshot. Not full JSON — the model reads it. */
export function serializeSnapshot(s: GameState): string {
  const sb = s.stateBlock
  const lines: string[] = []

  lines.push(`PM: ${s.pmName}`)
  lines.push(`Calendar: Week ${s.calendar.week} · ${s.calendar.dateISO} · ${s.calendar.daysToLocals} days to locals · Status ${s.status.toUpperCase()}`)

  const custom = sb.custom.map((c) => `${c.label} ${c.value}${c.suffix}`).join(' · ')
  lines.push(
    `State: Approval ${sb.approval}% · Reform ${sb.reform}% · GBP/USD ${sb.gbp} · 10y gilt ${sb.gilt}% · Capital ${sb.capital}/100 · Whip ${sb.whip} · Threat ${THREAT_LABELS[Math.round(sb.threat) - 1] ?? sb.threat}` +
      (custom ? ` · ${custom}` : ''),
  )

  lines.push('')
  lines.push('DOCTRINE (locked):')
  for (const k of DOCTRINE_KEYS) {
    const d = s.doctrine[k]
    lines.push(`  ${DOCTRINE_LABELS[k]}: ${d.value}${d.summary ? ` — ${d.summary}` : ''}`)
  }

  if (s.cabinet.length) {
    lines.push('')
    lines.push('CABINET:')
    for (const m of s.cabinet) lines.push(`  ${m.id} · ${m.name} — ${m.role} (${m.faction}, standing ${m.standing})`)
  }
  if (s.standingCast.length) {
    lines.push('')
    lines.push('STANDING CAST:')
    for (const m of s.standingCast) lines.push(`  ${m.id} · ${m.name} — ${m.role}`)
  }

  const liveLoops = s.openLoops.filter((l) => !TERMINAL_LOOP_STATUSES.includes(l.status))
  if (liveLoops.length) {
    lines.push('')
    lines.push('OPEN LOOPS:')
    for (const l of liveLoops) {
      const due = isLoopDue(l, s.calendar.week) ? ' [DUE]' : ''
      lines.push(`  ${l.id} · ${l.who ? l.who + ': ' : ''}${l.title} — due W${l.dueWeek} · ${l.status}${due}`)
    }
  }

  if (s.streams.length) {
    lines.push('')
    lines.push('STREAMS:')
    for (const st of s.streams) lines.push(`  ${st.id} · ${st.name}: ${st.reading} (${st.trend})`)
  }

  if (s.foreignCapitals.length) {
    lines.push('')
    lines.push('FOREIGN CAPITALS:')
    for (const c of s.foreignCapitals) lines.push(`  ${c.id} · ${c.name}: read ${c.read}${c.posture ? ` — ${c.posture}` : ''}`)
  }

  // Only TRIGGERED secrets are shared — untriggered ones stay engine-side.
  const shownSecrets = s.buriedButLive.filter((x) => x.triggered)
  if (shownSecrets.length) {
    lines.push('')
    lines.push('SURFACED SECRETS:')
    for (const x of shownSecrets) lines.push(`  ${x.id} · ${x.title} — ${x.detail}`)
  }

  if (s.keyHistory.length) {
    lines.push('')
    lines.push('KEY HISTORY (recent):')
    for (const h of s.keyHistory.slice(-6)) lines.push(`  W${h.week}: ${h.summary}`)
  }

  if (s.narrativeSummary) {
    lines.push('')
    lines.push(`RECAP: ${s.narrativeSummary}`)
  }

  return lines.join('\n')
}

function rollsBlock(s: GameState): string {
  const r = s.pendingRolls
  if (!r) return ''
  const parts: string[] = []
  if (r.action) {
    parts.push(
      `Action resolution: d100=${r.action.roll} vs difficulty ${r.action.difficulty} → ${r.action.tier.toUpperCase()} (margin ${r.action.margin >= 0 ? '+' : ''}${r.action.margin}). Narrate this outcome honestly; do not override it.`,
    )
  }
  if (r.worldVariance) parts.push(r.worldVariance.directive)
  if (r.event) parts.push(`RANDOM EVENT — ${r.event.title}: ${r.event.directive}`)
  return parts.join('\n')
}

/** Assemble the full prompt for the current turn. `mode` selects the output
 *  contract: 'chat' (prose + fenced <<<DELTA>>> block, for the copy-paste relay)
 *  or 'api' (a single JSON object with the narrative in `scene`, for direct calls). */
export function buildTurnPrompt(s: GameState, mode: PromptMode = 'chat'): string {
  const opening = !s.chosenAction.trim() && !s.options
  const rules = `${RULES_CORE}\n\n${mode === 'api' ? OUTPUT_CONTRACT_API : OUTPUT_CONTRACT_CHAT}`
  const sections: string[] = [rules, '', '━━━ STATE SNAPSHOT ━━━', serializeSnapshot(s)]

  const rolls = rollsBlock(s)
  if (rolls) {
    sections.push('', "━━━ THIS WEEK'S ENGINE ROLLS (narrate, don't re-roll) ━━━", rolls)
  }

  const dueLoops = s.openLoops.filter((l) => isLoopDue(l, s.calendar.week))
  if (dueLoops.length) {
    sections.push(
      '',
      '━━━ DUE THIS WEEK — MUST ADDRESS ━━━',
      dueLoops.map((l) => `- ${l.id}: ${l.who ? l.who + ' — ' : ''}${l.title}`).join('\n'),
    )
  }

  if (s.pendingInjections.length) {
    sections.push('', '━━━ ALSO IN PLAY THIS WEEK ━━━', s.pendingInjections.map((i) => `- ${i}`).join('\n'))
  }

  sections.push('', '━━━ THE PM ━━━')
  if (opening) {
    sections.push(
      `This is the opening turn (Week ${s.calendar.week}, ${s.calendar.dateISO}). Set the scene at Number 10, establish the mood, and present the first real decision with three options. No action has been taken yet.`,
    )
  } else {
    sections.push(`The PM's decision this week: ${s.chosenAction}`)
  }

  // The few-shot teaches the fenced-block format, so it's chat-only.
  const includeFewShot = mode === 'chat' && (s.turnIndex <= 1 || s.houseRules.modelProfile === 'other')
  if (includeFewShot) sections.push('', FEW_SHOT)

  sections.push(
    '',
    mode === 'api'
      ? 'Now: return the single JSON object — the scene (with three options written into it) plus any state changes.'
      : 'Now: write the scene, present three options, and emit the DELTA block.',
  )
  return sections.join('\n')
}
