import type { CastMember, ForeignCapital, OpenLoop } from '../state/schema'
import { TERMINAL_LOOP_STATUSES } from '../state/schema'

/**
 * Derived associations for the Dossier: which open loops belong to which
 * minister or foreign capital. Loops carry a free-text `who` (e.g. "Treasury",
 * "C", "Washington"), so we tie them back to the actual cast/capital records by
 * matching names, role keywords, department nicknames and leader names. Pure and
 * engine-agnostic — this is presentation logic, it never mutates state.
 */

/** The real-world leader who personifies each foreign capital (display + matching). */
export const CAPITAL_LEADERS: Record<string, string> = {
  Washington: 'Trump',
  Paris: 'Macron',
  Berlin: 'Merz',
  Brussels: 'von der Leyen',
  Beijing: 'Xi',
  Moscow: 'Putin',
}

// Role words that carry no identity on their own.
const ROLE_STOPWORDS = new Set([
  'the', 'and', 'for', 'of', 'state', 'secretary', 'minister', 'director',
  'chief', 'eyes', 'ears', 'cabinet', 'office',
])

// Department / nickname synonyms, added when the role text hits the key.
const DEPT_SYNONYMS: { test: RegExp; add: string[] }[] = [
  { test: /chancellor/i, add: ['treasury', 'exchequer', 'no.11', 'number 11', 'red box'] },
  { test: /foreign/i, add: ['fcdo', 'foreign office'] },
  { test: /home secretary|home office/i, add: ['home office', 'home sec'] },
  { test: /defence/i, add: ['mod', 'ministry of defence'] },
  { test: /whip/i, add: ['whips'] },
  { test: /communications/i, add: ['comms', 'the grid'] },
  { test: /cabinet secretary/i, add: ['cab sec', 'cabinet sec', 'the machine', 'civil service'] },
  { test: /cabinet office/i, add: ['cabinet office', 'delivery unit'] },
  { test: /sis|"c"/i, add: ['sis', 'mi6', 'the service', 'secret intelligence'] },
  { test: /health/i, add: ['nhs', 'dhsc'] },
  { test: /justice/i, add: ['moj', 'the courts'] },
  { test: /energy/i, add: ['desnz'] },
  { test: /education/i, add: ['dfe', 'schools'] },
  { test: /business/i, add: ['dbt', 'industry'] },
]

function lastName(name: string): string | null {
  const parts = name.trim().split(/\s+/)
  const last = parts[parts.length - 1]
  return last && last.length >= 3 ? last.toLowerCase() : null
}

/** Lowercase, deduped set of strings that, if named, point at this actor. */
export function actorAliases(member: { name: string; role: string }): string[] {
  const set = new Set<string>()

  const ln = lastName(member.name)
  if (ln) set.add(ln)

  for (const tok of member.role.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length >= 3 && !ROLE_STOPWORDS.has(tok)) set.add(tok)
  }

  // A quoted single-letter codename — e.g. the SIS chief, "C".
  const codename = member.role.match(/"([a-z])"/i)
  if (codename) set.add(codename[1].toLowerCase())

  for (const { test, add } of DEPT_SYNONYMS) {
    if (test.test(member.role)) for (const a of add) set.add(a)
  }
  return [...set]
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-word (boundary) containment, case-insensitive — avoids "home" hitting
 *  "homelessness" or the codename "c" hitting every word. */
function mentions(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false
  return new RegExp(`(^|[^a-z0-9])${escapeRe(needle)}([^a-z0-9]|$)`, 'i').test(haystack)
}

function anyMention(haystack: string, needles: string[]): boolean {
  return needles.some((n) => mentions(haystack, n))
}

export function isLive(loop: OpenLoop): boolean {
  return !TERMINAL_LOOP_STATUSES.includes(loop.status)
}

function capitalNeedles(name: string): string[] {
  const leader = CAPITAL_LEADERS[name]
  return [name.toLowerCase(), ...(leader ? [leader.toLowerCase()] : [])]
}

/** Live loops whose owner (`who`) or title names this cast member. */
export function loopsForActor(loops: OpenLoop[], member: { name: string; role: string }): OpenLoop[] {
  const aliases = actorAliases(member)
  return loops.filter((l) => isLive(l) && (anyMention(l.who, aliases) || anyMention(l.title, aliases)))
}

/** Live loops that name this capital or its leader anywhere. */
export function loopsForCapital(loops: OpenLoop[], capital: { name: string }): OpenLoop[] {
  const needles = capitalNeedles(capital.name)
  return loops.filter(
    (l) => isLive(l) && (anyMention(l.who, needles) || anyMention(l.title, needles) || anyMention(l.detail, needles)),
  )
}

export type LoopActor =
  | { kind: 'cast'; member: CastMember }
  | { kind: 'capital'; capital: ForeignCapital; leader: string | null }

/**
 * The single actor a loop is most plausibly "about", for the owner chip on the
 * loop itself. Prefers a named owner (`who`) over a title mention, and a named
 * minister over a capital. Returns null when nothing matches.
 */
export function resolveLoopActor(
  loop: OpenLoop,
  cabinet: CastMember[],
  standingCast: CastMember[],
  capitals: ForeignCapital[],
): LoopActor | null {
  const cast = [...cabinet, ...standingCast]

  for (const m of cast) if (anyMention(loop.who, actorAliases(m))) return { kind: 'cast', member: m }

  for (const c of capitals) {
    const needles = capitalNeedles(c.name)
    if (anyMention(loop.who, needles) || anyMention(loop.title, needles)) {
      return { kind: 'capital', capital: c, leader: CAPITAL_LEADERS[c.name] ?? null }
    }
  }

  for (const m of cast) if (anyMention(loop.title, actorAliases(m))) return { kind: 'cast', member: m }

  return null
}
