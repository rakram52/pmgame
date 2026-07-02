import type { ComponentChildren } from 'preact'
import type { CastMember } from '../state/schema'
import { parseDialogue, SPEAKER_PALETTE, type Dialogue } from './speakers'

/**
 * Minimal, safe renderer for the narrator's scenes. No dangerouslySetInnerHTML —
 * everything is real text nodes. It handles **bold**, *italic*, inline
 * intelligence tags ([A1]…[D4]), classifies `*[label]*` document lines into
 * wires, flashes, memos and front pages (US-401 / US-404), and colours each
 * character's spoken lines by speaker (with a role tag for known cast).
 */

// ---------------------------------------------------------------------------
// Inline parsing (bold / italic / intelligence chips)
// ---------------------------------------------------------------------------

const INLINE_RE = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([A-D][1-4])\])/g

function parseInline(line: string, keyBase: string): ComponentChildren[] {
  const nodes: ComponentChildren[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(line)) !== null) {
    if (m.index > last) nodes.push(line.slice(last, m.index))
    if (m[2] != null) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>)
    else if (m[4] != null) nodes.push(<em key={`${keyBase}-i${i}`}>{m[4]}</em>)
    else if (m[6] != null)
      nodes.push(
        <span key={`${keyBase}-t${i}`} class={`intel-chip ig-${m[6][0].toLowerCase()}`}>
          {m[6]}
        </span>,
      )
    last = m.index + m[0].length
    i++
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}

// ---------------------------------------------------------------------------
// Document classification
// ---------------------------------------------------------------------------

type DocType = 'wire' | 'flash' | 'note' | 'frontpage' | 'doc'

const DOC_LINE_RE = /^\s*\*?\[([^\]]+)\]\*?\s*(.*)$/

/** Classify a document by its label. Tolerant: unknown labels fall back to a
 *  generic doc. */
export function classifyDoc(label: string): DocType {
  const l = label.toLowerCase()
  if (/(the sun|daily mail|\bmail\b|guardian|the times\b|telegraph|mirror|express|metro|standard|front page|splash|new statesman|spectator)/.test(l)) return 'frontpage'
  if (/(reuters|pa media|press association|associated press|bloomberg|\bafp\b|\bwire\b|\bap\b|newswire|newsflash)/.test(l)) return 'wire'
  if (/(fcdo|cobra|\bmi[56]\b|\bsis\b|\bjic\b|\bgchq\b|intel|flash|sitrep|situation report|def intel)/.test(l) || /\b[a-d][1-4]\b/.test(l)) return 'flash'
  if (/(\bpps\b|cabinet office|memo|number 10|no\.?\s?10|private secretary|minute|read-?out|\bnote\b|briefing|submission|dispatch)/.test(l)) return 'note'
  return 'doc'
}

// ---------------------------------------------------------------------------
// Document block rendering
// ---------------------------------------------------------------------------

function FrontPage({ label, body, keyBase }: { label: string; body: string[]; keyBase: string }) {
  const headline = body[0] ?? ''
  const standfirst = body.slice(1)
  return (
    <div class="rt-frontpage">
      <div class="fp-masthead">{label}</div>
      {headline && <div class="fp-headline">{parseInline(headline, `${keyBase}-h`)}</div>}
      {standfirst.length > 0 && (
        <div class="fp-standfirst">
          {standfirst.map((line, i) => (
            <span key={i}>{parseInline(line, `${keyBase}-s${i}`)} </span>
          ))}
        </div>
      )}
    </div>
  )
}

function DocBlock({ type, label, body, keyBase }: { type: DocType; label: string; body: string[]; keyBase: string }) {
  if (type === 'frontpage') return <FrontPage label={label} body={body} keyBase={keyBase} />
  return (
    <div class={`rt-card rt-${type}`}>
      <div class="rt-card-tag">{label}</div>
      {body.map((line, i) => (
        <p key={i} class="rt-card-line">
          {parseInline(line, `${keyBase}-l${i}`)}
        </p>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialogue rendering (one coloured line per speaker)
// ---------------------------------------------------------------------------

function DialogueLine({ d, keyBase }: { d: Dialogue; keyBase: string }) {
  const color = SPEAKER_PALETTE[d.colorIndex]
  return (
    <p class="rt-dialogue" style={`--sp-color:${color}`}>
      <span class="rt-speaker">{d.speaker}</span>
      {d.roleTag && <span class="rt-role">{d.roleTag}</span>}
      {d.aside && <span class="rt-aside"> ({d.aside})</span>}{' '}
      <span class="rt-quote">{parseInline(d.quote, keyBase)}</span>
    </p>
  )
}

export function RichText({ text, cast = [] }: { text: string; cast?: CastMember[] }) {
  const lines = (text || '').split('\n')
  const out: ComponentChildren[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      out.push(<div key={`g${i}`} class="rt-gap" />)
      i++
      continue
    }
    const m = DOC_LINE_RE.exec(line)
    if (m) {
      const label = m[1].trim()
      const type = classifyDoc(label)
      const body: string[] = []
      if (m[2].trim()) body.push(m[2].trim())
      i++
      // Absorb following non-blank, non-tag, non-dialogue lines as the doc body.
      while (i < lines.length && lines[i].trim() && !DOC_LINE_RE.test(lines[i]) && !parseDialogue(lines[i], cast)) {
        body.push(lines[i].trim())
        i++
      }
      out.push(<DocBlock key={`d${i}`} type={type} label={label} body={body} keyBase={`d${i}`} />)
      continue
    }
    const dialogue = parseDialogue(line, cast)
    if (dialogue) {
      out.push(<DialogueLine key={i} d={dialogue} keyBase={String(i)} />)
      i++
      continue
    }
    out.push(
      <p key={i} class="rt-line">
        {parseInline(line, String(i))}
      </p>,
    )
    i++
  }
  return <div class="richtext">{out}</div>
}
