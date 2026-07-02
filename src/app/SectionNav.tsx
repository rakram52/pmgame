import type { ComponentChildren } from 'preact'

export interface SectionDef {
  key: string
  label: string
  /** Optional count badge (e.g. items due). Falsy/zero hides it. */
  badge?: number
}

/** A pinned, horizontally-scrollable pill menu for switching between the
 *  sub-views of a long tab (Dossier, State). Pairs with a `.tabview` wrapper
 *  whose scroll region renders the active section. */
export function SectionNav({ sections, active, onSelect }: { sections: SectionDef[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div class="subnav" role="tablist">
      {sections.map((s) => (
        <button
          key={s.key}
          role="tab"
          aria-selected={active === s.key}
          class={`subnav-btn ${active === s.key ? 'on' : ''}`}
          onClick={() => onSelect(s.key)}
        >
          {s.label}
          {s.badge ? <span class="subnav-badge">{s.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

/** Wrapper that pins a SectionNav above a scrolling content region. */
export function TabView({ children }: { children: ComponentChildren }) {
  return <div class="tabview">{children}</div>
}
