import type { Faction } from '../state/schema'

/**
 * Deterministic, offline SVG portraits (US-402). A cast member's id + name seed a
 * stable monogram roundel tinted by faction colour — no image pipeline, no
 * network, no Math.random, identical across reloads.
 */

const FACTION_COLORS: Record<Faction, string> = {
  'soft-left': '#e07a9a',
  starmerite: '#e9c777',
  'blue-labour': '#6fa8e0',
  official: '#7f8aa3',
  independent: '#5bb0a6',
  other: '#8a93a8',
}

export function castColor(faction: Faction): string {
  return FACTION_COLORS[faction] ?? FACTION_COLORS.other
}

/** Up to two initials from a name (handles quoted codenames like "C"). */
export function initialsOf(name: string): string {
  const cleaned = name.replace(/["'.]/g, ' ').trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (!words.length) return '·'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Stable FNV-1a hash → uint32. */
function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function Portrait({ seed, label, color = FACTION_COLORS.other, size = 36 }: { seed: string; label: string; color?: string; size?: number }) {
  const h = hashStr(seed)
  const angle = h % 360 // deterministic accent rotation → per-person uniqueness
  const r = size / 2
  const initials = initialsOf(label)
  const fontSize = initials.length > 1 ? size * 0.36 : size * 0.44

  return (
    <svg class="portrait" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={r} cy={r} r={r - 1} fill={color} fill-opacity="0.16" stroke={color} stroke-opacity="0.7" stroke-width="1" />
      {/* deterministic accent arc — a stable per-seed flourish */}
      <path
        d={`M ${r} 1 A ${r - 1} ${r - 1} 0 0 1 ${r + (r - 1) * Math.sin(0.9)} ${r - (r - 1) * Math.cos(0.9)}`}
        fill="none"
        stroke={color}
        stroke-opacity="0.85"
        stroke-width="1.5"
        stroke-linecap="round"
        transform={`rotate(${angle} ${r} ${r})`}
      />
      <text x={r} y={r} dy="0.02em" text-anchor="middle" dominant-baseline="central" fill={color} font-size={fontSize} font-weight="700" font-family="var(--font-ui)">
        {initials}
      </text>
    </svg>
  )
}
