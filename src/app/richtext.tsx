import type { ComponentChildren } from 'preact'

/** Minimal, safe inline renderer for **bold**, *italic* and line breaks.
 *  No dangerouslySetInnerHTML — everything is real text nodes. */
function parseInline(line: string, keyBase: string): ComponentChildren[] {
  const nodes: ComponentChildren[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) nodes.push(line.slice(last, m.index))
    if (m[2] != null) nodes.push(<strong key={`${keyBase}-b${i}`}>{m[2]}</strong>)
    else if (m[3] != null) nodes.push(<em key={`${keyBase}-i${i}`}>{m[3]}</em>)
    last = m.index + m[0].length
    i++
  }
  if (last < line.length) nodes.push(line.slice(last))
  return nodes
}

export function RichText({ text }: { text: string }) {
  const lines = (text || '').split('\n')
  return (
    <div class="richtext">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} class="rt-gap" />
        const isDoc = /^\s*\[.*\]/.test(line) || /^\s*\*\[.*\]\*/.test(line)
        return (
          <p key={idx} class={isDoc ? 'rt-doc' : 'rt-line'}>
            {parseInline(line, String(idx))}
          </p>
        )
      })}
    </div>
  )
}
