import type { CastMember } from '../state/schema'

/**
 * Resolves a scene's spoken lines to the cast, so each character reads in their
 * own colour and a recognised minister shows their brief. The narrator emits
 * dialogue as speaker-led lines — `Beaumont: "…"` — and this turns one of those
 * lines into a {@link Dialogue} descriptor the renderer can style.
 */

/** Distinct, dark-background-legible hues, assigned per speaker and stable for a
 *  given character across the whole game (keyed off their id, not the wording). */
export const SPEAKER_PALETTE = [
  '#6fb3ff', // blue
  '#f2a65a', // orange
  '#6ddf9c', // green
  '#e57ea8', // pink
  '#b79bff', // violet
  '#e6d264', // gold
  '#5fd0d6', // teal
  '#ef7f6b', // coral
] as const

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Stable string hash → palette slot. */
function paletteIndex(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) >>> 0
  return h % SPEAKER_PALETTE.length
}

const TITLE_PREFIX = /^(the|rt hon|right honourable|sir|dame|lord|lady|mr|mrs|ms|miss|dr|prof|professor)\s+/

/** Every way the scene might name a role, so "the Chancellor" resolves to the
 *  Chancellor of the Exchequer and "the Health Secretary" to the SoS for Health. */
function roleAliases(role: string): string[] {
  const r = normalize(role)
  const out = new Set<string>([r])
  const sos = r.match(/secretary of state for (.+)/)
  if (sos) {
    out.add(`${sos[1]} secretary`)
    out.add(`${sos[1]} sec`)
    out.add(sos[1])
  }
  if (r.includes('chancellor')) out.add('chancellor')
  if (r.includes('foreign')) {
    out.add('foreign secretary')
    out.add('foreign sec')
    out.add('foreign minister')
  }
  if (r.includes('home secretary')) {
    out.add('home secretary')
    out.add('home sec')
  }
  if (r.includes('defence') || r.includes('defense')) {
    out.add('defence secretary')
    out.add('defence sec')
    out.add('defense secretary')
  }
  if (r.includes('chief whip')) {
    out.add('chief whip')
    out.add('whip')
  }
  if (r.includes('cabinet office')) {
    out.add('cabinet office minister')
    out.add('cabinet office')
  }
  if (r.includes('director of communications')) {
    out.add('director of communications')
    out.add('comms director')
    out.add('director of comms')
    out.add('comms chief')
  }
  if (r.includes('cabinet secretary')) {
    out.add('cabinet secretary')
    out.add('cab sec')
  }
  if (r.includes('chief of sis') || role.includes('"C"')) {
    out.add('c')
    out.add('chief of sis')
    out.add('head of mi6')
    out.add('sis chief')
  }
  if (r.startsWith('pps')) {
    out.add('pps')
    out.add('parliamentary private secretary')
  }
  return [...out]
}

/** Short, readable tag shown after a resolved figure's name (e.g. "Foreign Sec"). */
export function roleTag(role: string): string {
  const r = role.toLowerCase()
  if (r.includes('chancellor')) return 'Chancellor'
  if (r.includes('foreign')) return 'Foreign Sec'
  if (r.includes('home secretary')) return 'Home Sec'
  if (r.includes('defence') || r.includes('defense')) return 'Defence Sec'
  if (r.includes('chief whip')) return 'Chief Whip'
  if (r.includes('cabinet office')) return 'Cabinet Office'
  if (r.includes('director of communications')) return 'Comms'
  if (r.includes('cabinet secretary')) return 'Cab Sec'
  if (r.includes('chief of sis') || role.includes('"C"')) return 'C · SIS'
  if (r.startsWith('pps')) return 'PPS'
  const sos = role.match(/Secretary of State for (.+)/i)
  if (sos) return `${sos[1].trim()} Sec`
  return role.length <= 16 ? role : role.split(/\s+/).slice(0, 2).join(' ')
}

const ARTICLES = new Set(['a', 'an', 'the'])

/** Leading words that mark a sentence, not a speaker label — so we don't colour
 *  "There was only one question:" or "He said:" as though someone spoke. */
const SENTENCE_STARTERS = new Set([
  'he', 'she', 'they', 'it', 'we', 'you', 'i', 'there', 'this', 'that', 'these', 'those',
  'who', 'what', 'when', 'where', 'why', 'how', 'and', 'but', 'so', 'yet', 'if', 'because',
])

/** Does this read like a person/role name rather than a stray sentence fragment
 *  that happens to sit before a quote? Short (≤4 words), led by a Capitalised
 *  word or an article, and not opened by a pronoun/conjunction. */
function looksLikeSpeaker(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 32) return false
  const tokens = trimmed.split(/\s+/)
  if (tokens.length === 0 || tokens.length > 4) return false
  const first = tokens[0].toLowerCase()
  if (SENTENCE_STARTERS.has(first)) return false
  if (!ARTICLES.has(first) && !/^[A-Z]/.test(tokens[0])) return false
  return tokens.some((t) => /^[A-Z]/.test(t))
}

export interface Dialogue {
  /** The speaker name as written, minus any stage-direction. */
  speaker: string
  /** Parenthetical / post-comma stage-direction (without brackets), or ''. */
  aside: string
  /** The spoken text, with quote marks as written. */
  quote: string
  /** Resolved cast member, if we recognised them. */
  member: CastMember | null
  /** Short role tag to show after the name (only when matched by NAME). */
  roleTag: string | null
  /** Palette slot for this speaker's colour. */
  colorIndex: number
}

// Speaker label: an optional **emphasis** wrap, a name starting with a letter and
// free of colons/quotes/asterisks, then a colon and a quoted line.
const DIALOGUE_RE = /^\s*\*{0,2}\s*([A-Za-z][^:"“”'‘*]{0,47}?)\s*:\s*\*{0,2}\s*(["“'‘].+)$/

/** Parse a scene line as a character's spoken line, or return null. `cast` is
 *  cabinet + standing cast, used to colour and role-tag recognised figures. */
export function parseDialogue(line: string, cast: CastMember[]): Dialogue | null {
  const m = DIALOGUE_RE.exec(line)
  if (!m) return null
  const rawLabel = m[1].trim()
  const quote = m[2].trim()

  // Peel off a stage-direction: a trailing "(…)" or everything after a comma.
  let name = rawLabel
  let aside = ''
  const paren = name.match(/^([^(]*)\(([^)]*)\)\s*$/)
  if (paren) {
    name = paren[1].trim()
    aside = paren[2].trim()
  }
  const comma = name.indexOf(',')
  if (comma >= 0) {
    const tail = name.slice(comma + 1).trim()
    aside = aside ? `${tail}, ${aside}` : tail
    name = name.slice(0, comma).trim()
  }
  if (!name) return null

  const bare = normalize(name).replace(TITLE_PREFIX, '').trim()

  let member: CastMember | null = null
  let matchedBy: 'name' | 'role' | null = null

  for (const c of cast) {
    const cn = normalize(c.name)
    const surname = cn.split(' ').pop() || cn
    if (bare === cn || (surname.length >= 3 && bare.split(' ').includes(surname))) {
      member = c
      matchedBy = 'name'
      break
    }
  }
  if (!member) {
    for (const c of cast) {
      if (roleAliases(c.role).includes(bare)) {
        member = c
        matchedBy = 'role'
        break
      }
    }
  }

  // Only commit to a dialogue line if we know the speaker or it reads like a name.
  if (!member && !looksLikeSpeaker(name)) return null

  return {
    speaker: name,
    aside,
    quote,
    member,
    roleTag: member && matchedBy === 'name' ? roleTag(member.role) : null,
    colorIndex: paletteIndex(member ? member.id : bare || rawLabel),
  }
}
