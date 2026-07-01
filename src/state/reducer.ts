import type { GameState, GameStatus } from './schema'
import type { TurnDelta } from './delta'
import { clamp } from '../engine/resolve'
import { isSetpiece } from '../engine/turnKinds'
import { computeEnding } from '../engine/endings'

/** Next-cycle countdown reset after the locals resolve (annual cadence). */
const NEXT_LOCALS_DAYS = 364
const STAT_HISTORY_CAP = 60
const SETPIECE_HISTORY_CAP = 40

/**
 * Applies a validated TurnDelta to canonical state. This is the anti-drift core.
 * Invariants enforced HERE, in code, regardless of what the model sent:
 *   - numbers are clamped to legal ranges (deltas can't push state absurd);
 *   - open loops are never dropped — only explicitly resolved;
 *   - keyHistory is append-only;
 *   - status (crisis tier) is computed by code, not trusted from the model.
 *
 * Pure and deterministic: no Date, no RNG. Timestamps are set by the store on
 * save, so a replay of the same inputs yields byte-identical state.
 */

export interface ReduceResult {
  state: GameState
  warnings: string[]
}

const RANGES: Record<string, [number, number]> = {
  approval: [0, 100],
  reform: [0, 100],
  capital: [0, 100],
  whip: [-100, 300],
  gilt: [0, 30],
  gbp: [0.5, 3],
  threat: [1, 5],
}

export function applyDelta(prev: GameState, delta: TurnDelta, prose: string): ReduceResult {
  const s: GameState = structuredClone(prev)
  const warnings: string[] = []
  const wasDecision = s.chosenAction.trim().length > 0
  const nid = (prefix: string) => `${prefix}${s.idCounter++}`

  // 1. State-block deltas (deltas, not absolutes — clamped).
  if (delta.stateBlock) {
    for (const [key, d] of Object.entries(delta.stateBlock)) {
      if (key in RANGES) {
        const [min, max] = RANGES[key]
        ;(s.stateBlock as any)[key] = clamp((s.stateBlock as any)[key] + d, min, max)
      } else {
        const custom = s.stateBlock.custom.find((c) => c.key === key)
        if (custom) custom.value = clamp(custom.value + d, custom.min, custom.max)
        else warnings.push(`Ignored delta for unknown stat "${key}".`)
      }
    }
  }

  // 2. New tracked numeric rows.
  if (delta.addStats) {
    for (const st of delta.addStats) {
      const existing = s.stateBlock.custom.find((c) => c.key === st.key)
      if (existing) {
        existing.value = clamp(st.value, existing.min, existing.max)
      } else {
        const min = st.min ?? 0
        const max = st.max ?? 100
        s.stateBlock.custom.push({ key: st.key, label: st.label, value: clamp(st.value, min, max), min, max, suffix: st.suffix ?? '' })
      }
    }
  }

  // 3. Calendar. Each resolved decision advances ~one week by default.
  const advance = delta.calendar?.advanceWeeks ?? (wasDecision ? 1 : 0)
  if (advance !== 0) {
    s.calendar.week += advance
    s.calendar.dateISO = addDays(s.calendar.dateISO, advance * 7)
    s.calendar.daysToLocals = Math.max(0, s.calendar.daysToLocals - advance * 7)
  }
  if (delta.calendar?.setDateISO) s.calendar.dateISO = delta.calendar.setDateISO
  if (typeof delta.calendar?.daysToLocalsDelta === 'number') {
    s.calendar.daysToLocals = Math.max(0, s.calendar.daysToLocals + delta.calendar.daysToLocalsDelta)
  }
  // Once the locals have been held (this is the election-night week), roll the
  // countdown on to the next annual cycle so the set-piece can't re-fire.
  if (s.turnKind === 'election' && s.calendar.daysToLocals <= 0) {
    s.calendar.daysToLocals = NEXT_LOCALS_DAYS
  }

  // 4. Open loops — add / update / resolve. Never silently dropped.
  if (delta.openLoops?.add) {
    for (const a of delta.openLoops.add) {
      s.openLoops.push({
        id: nid('loop'),
        who: a.who ?? '',
        title: a.title,
        detail: a.detail ?? '',
        commissionedWeek: s.calendar.week,
        dueWeek: s.calendar.week + (a.dueInWeeks ?? 1),
        status: 'commissioned',
        resolutionNote: '',
      })
    }
  }
  for (const u of delta.openLoops?.update ?? []) {
    const loop = s.openLoops.find((l) => l.id === u.id)
    if (!loop) {
      warnings.push(`Update for unknown open loop "${u.id}" — surfaced, not applied.`)
      continue
    }
    if (u.detail != null) loop.detail = u.detail
    if (u.dueWeekDelta != null) loop.dueWeek += u.dueWeekDelta
    if (u.status) loop.status = u.status
  }
  for (const r of delta.openLoops?.resolve ?? []) {
    const loop = s.openLoops.find((l) => l.id === r.id)
    if (!loop) {
      warnings.push(`Resolve for unknown open loop "${r.id}" — surfaced, not applied.`)
      continue
    }
    loop.status = r.outcome ?? 'resolved'
    if (r.note) loop.resolutionNote = r.note
  }

  // 5. Streams.
  if (delta.streams?.add) {
    for (const a of delta.streams.add) {
      s.streams.push({ id: nid('stream'), name: a.name, reading: a.reading ?? '', trend: a.trend ?? 'steady', lastUpdatedWeek: s.calendar.week })
    }
  }
  for (const u of delta.streams?.update ?? []) {
    const st = s.streams.find((x) => x.id === u.id)
    if (!st) {
      warnings.push(`Stream update for unknown id "${u.id}".`)
      continue
    }
    if (u.reading != null) st.reading = u.reading
    if (u.trend) st.trend = u.trend
    st.lastUpdatedWeek = s.calendar.week
  }

  // 6. Cabinet.
  if (delta.cabinet?.add) {
    for (const a of delta.cabinet.add) {
      s.cabinet.push({ id: nid('cab'), name: a.name, role: a.role, faction: a.faction ?? 'other', agenda: a.agenda ?? '', standing: 0, notes: '' })
    }
  }
  for (const u of delta.cabinet?.update ?? []) {
    const m = s.cabinet.find((x) => x.id === u.id) ?? s.standingCast.find((x) => x.id === u.id)
    if (!m) {
      warnings.push(`Cabinet update for unknown id "${u.id}".`)
      continue
    }
    if (u.standingDelta != null) m.standing = clamp(m.standing + u.standingDelta, -100, 100)
    if (u.agenda != null) m.agenda = u.agenda
    if (u.notes != null) m.notes = u.notes
  }
  for (const rm of delta.cabinet?.remove ?? []) {
    const idx = s.cabinet.findIndex((x) => x.id === rm.id)
    if (idx >= 0) {
      const [gone] = s.cabinet.splice(idx, 1)
      gone.notes = rm.reason ? `Left cabinet: ${rm.reason}` : 'Left cabinet.'
      s.standingCast.push(gone) // people persist by name even after they go
    } else {
      warnings.push(`Cabinet remove for unknown id "${rm.id}".`)
    }
  }

  // 7. Foreign capitals — resolve by id or name; create if genuinely new.
  for (const f of delta.foreignCapitals ?? []) {
    let cap = f.id ? s.foreignCapitals.find((c) => c.id === f.id) : undefined
    if (!cap && f.name) cap = s.foreignCapitals.find((c) => c.name.toLowerCase() === f.name!.toLowerCase())
    if (!cap) {
      if (f.name) {
        cap = { id: nid('cap'), name: f.name, read: 0, posture: '', lastUpdatedWeek: s.calendar.week }
        s.foreignCapitals.push(cap)
      } else {
        warnings.push('Foreign-capital update with no id or name — ignored.')
        continue
      }
    }
    if (f.readDelta != null) cap.read = clamp(cap.read + f.readDelta, -100, 100)
    if (f.posture != null) cap.posture = f.posture
    cap.lastUpdatedWeek = s.calendar.week
  }

  // 8. Buried-but-live.
  if (delta.buriedButLive?.add) {
    for (const a of delta.buriedButLive.add) {
      s.buriedButLive.push({ id: nid('secret'), title: a.title, detail: a.detail ?? '', exposureRisk: clamp(a.exposureRisk ?? 10, 0, 100), triggered: false, plantedWeek: s.calendar.week })
    }
  }
  for (const t of delta.buriedButLive?.trigger ?? []) {
    const sec = s.buriedButLive.find((x) => x.id === t.id)
    if (!sec) {
      warnings.push(`Trigger for unknown secret "${t.id}".`)
      continue
    }
    sec.triggered = true
  }

  // 9. Key history — append-only.
  if (delta.keyHistoryAppend && delta.keyHistoryAppend.trim()) {
    s.keyHistory.push({ week: s.calendar.week, turnIndex: s.turnIndex, summary: delta.keyHistoryAppend.trim() })
  }

  // 9a. Set-piece log — record each set-piece week once (drives the balancer +
  //     the timeline tags). The scene is generated on the turn its kind is set.
  if (isSetpiece(s.turnKind)) {
    s.setpieceHistory.push({ week: s.calendar.week, turnIndex: s.turnIndex, kind: s.turnKind })
    if (s.setpieceHistory.length > SETPIECE_HISTORY_CAP) s.setpieceHistory = s.setpieceHistory.slice(-SETPIECE_HISTORY_CAP)
  }

  // 9b. Stat history — one capped, append-only sample per commit, for sparklines.
  {
    const sb = s.stateBlock
    s.statHistory.push({
      week: s.calendar.week,
      turnIndex: s.turnIndex,
      approval: sb.approval,
      reform: sb.reform,
      capital: sb.capital,
      whip: sb.whip,
      gilt: sb.gilt,
      gbp: sb.gbp,
      threat: sb.threat,
    })
    if (s.statHistory.length > STAT_HISTORY_CAP) s.statHistory = s.statHistory.slice(-STAT_HISTORY_CAP)
  }

  // 10. Narrative summary (rolling, code-trimmed).
  if (delta.narrativeSummary != null) s.narrativeSummary = trimTo(delta.narrativeSummary, 900)

  // 11. Live turn surface.
  s.options = delta.options
  s.optionRisks = delta.optionRisks ?? { A: 'moderate', B: 'moderate', C: 'moderate' }
  s.currentScene = prose

  // 12. Advance the turn counter only when a real decision was resolved.
  if (wasDecision) s.turnIndex += 1

  // 13. Clear the per-turn surface. A queued set-piece is consumed by the turn
  //     it fired on, so clear it now.
  s.pendingRolls = null
  s.pendingInjections = []
  s.chosenAction = ''
  s.chosenRisk = null
  s.queuedTurnKind = null

  // 14. Crisis tier — computed by code, model's hint is advisory only.
  s.status = computeStatus(s)

  // 15. Terminal outcome — code-owned and sticky (once ended, stays ended).
  if (!s.ending) s.ending = computeEnding(s)

  return { state: s, warnings }
}

export function computeStatus(s: GameState): GameStatus {
  const { approval, capital, whip } = s.stateBlock
  if (approval < 15 || capital <= 0) return 'lost'
  if (approval < 25 || capital < 20 || whip < 0) return 'wounded'
  return 'stable'
}

function trimTo(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

/** Date math without Date.now(); parses an ISO date and adds days. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
