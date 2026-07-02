import { describe, it, expect } from 'vitest'
import { parseDialogue, roleTag } from './speakers'
import type { CastMember } from '../state/schema'

const cast: CastMember[] = [
  { id: 'cab0', name: 'Rachel Beaumont', role: 'Chancellor of the Exchequer', faction: 'starmerite', agenda: '', standing: 0, notes: '' },
  { id: 'cab1', name: 'Marcus Reeve', role: 'Foreign Secretary', faction: 'blue-labour', agenda: '', standing: 0, notes: '' },
  { id: 'cab2', name: 'Frank Dolan', role: 'Chief Whip', faction: 'starmerite', agenda: '', standing: 0, notes: '' },
  { id: 'cab3', name: 'Dr. Anita Rao', role: 'Secretary of State for Health', faction: 'official', agenda: '', standing: 0, notes: '' },
  { id: 'st0', name: 'Sir Edmund Hartley', role: 'Cabinet Secretary', faction: 'official', agenda: '', standing: 0, notes: '' },
  { id: 'st1', name: 'Sir Marcus Bell', role: '"C" — Chief of SIS', faction: 'official', agenda: '', standing: 0, notes: '' },
]

describe('parseDialogue', () => {
  it('matches a cabinet minister by surname and tags their brief', () => {
    const d = parseDialogue('Beaumont: "Twenty-two billion, Prime Minister."', cast)
    expect(d?.member?.id).toBe('cab0')
    expect(d?.speaker).toBe('Beaumont')
    expect(d?.roleTag).toBe('Chancellor')
    expect(d?.quote).toBe('"Twenty-two billion, Prime Minister."')
  })

  it('matches by full name', () => {
    const d = parseDialogue('Marcus Reeve: "The Americans will not like it."', cast)
    expect(d?.member?.id).toBe('cab1')
    expect(d?.roleTag).toBe('Foreign Sec')
  })

  it('resolves a role reference to the right person and suppresses the redundant tag', () => {
    const d = parseDialogue('The Chancellor: "I warned you."', cast)
    expect(d?.member?.id).toBe('cab0')
    expect(d?.roleTag).toBeNull()
  })

  it('gives a character the same colour whether named or referred to by role', () => {
    const byName = parseDialogue('Beaumont: "..."', cast)
    const byRole = parseDialogue('The Chancellor: "..."', cast)
    expect(byName?.colorIndex).toBe(byRole?.colorIndex)
  })

  it('handles a Secretary of State role reference', () => {
    const d = parseDialogue('The Health Secretary: "The wards are full."', cast)
    expect(d?.member?.id).toBe('cab3')
  })

  it('tags a named second-tier minister with a short brief', () => {
    const d = parseDialogue('Rao: "The wards are full."', cast)
    expect(d?.member?.id).toBe('cab3')
    expect(d?.roleTag).toBe('Health Sec')
  })

  it('resolves the SIS chief by "C"', () => {
    const d = parseDialogue('C: "One question, Prime Minister."', cast)
    expect(d?.member?.id).toBe('st1')
  })

  it('peels a parenthetical stage-direction off the name', () => {
    const d = parseDialogue('Beaumont (not looking up): "Pick two."', cast)
    expect(d?.speaker).toBe('Beaumont')
    expect(d?.aside).toBe('not looking up')
    expect(d?.member?.id).toBe('cab0')
  })

  it('peels a post-comma stage-direction off the name', () => {
    const d = parseDialogue('Dolan, quieter: "The benches will wear the money."', cast)
    expect(d?.speaker).toBe('Dolan')
    expect(d?.aside).toBe('quieter')
    expect(d?.member?.id).toBe('cab2')
  })

  it('tolerates a bolded speaker name', () => {
    const d = parseDialogue('**Beaumont:** "Twenty-two billion."', cast)
    expect(d?.member?.id).toBe('cab0')
  })

  it('colours an unknown but name-shaped speaker without a role tag', () => {
    const d = parseDialogue('A No.11 aide: "The PM\'s bill, not ours."', cast)
    expect(d).not.toBeNull()
    expect(d?.member).toBeNull()
    expect(d?.roleTag).toBeNull()
    expect(typeof d?.colorIndex).toBe('number')
  })

  it('does not treat a sentence fragment before a quote as dialogue', () => {
    expect(parseDialogue('There was only one question: "who leaked?"', cast)).toBeNull()
  })

  it('ignores a timestamp colon with no quoted line', () => {
    expect(parseDialogue('Week 4 — Tuesday 5 May 2026, 09:20.', cast)).toBeNull()
  })

  it('ignores ordinary narration', () => {
    expect(parseDialogue('The Cabinet Room falls silent.', cast)).toBeNull()
  })
})

describe('roleTag', () => {
  it('produces short readable tags', () => {
    expect(roleTag('Chancellor of the Exchequer')).toBe('Chancellor')
    expect(roleTag('Foreign Secretary')).toBe('Foreign Sec')
    expect(roleTag('Home Secretary')).toBe('Home Sec')
    expect(roleTag('Defence Secretary')).toBe('Defence Sec')
    expect(roleTag('Secretary of State for Education')).toBe('Education Sec')
    expect(roleTag('Cabinet Secretary')).toBe('Cab Sec')
  })
})
