import { describe, it, expect } from 'vitest'
import { actorAliases, loopsForActor, loopsForCapital, resolveLoopActor } from './links'
import type { CastMember, ForeignCapital, OpenLoop } from '../state/schema'

const chancellor: CastMember = { id: 'cab0', name: 'Rachel Beaumont', role: 'Chancellor of the Exchequer', faction: 'starmerite', agenda: '', standing: 15, notes: '' }
const home: CastMember = { id: 'cab2', name: 'Yvette Cormack', role: 'Home Secretary', faction: 'starmerite', agenda: '', standing: 15, notes: '' }
const sis: CastMember = { id: 'cab9', name: 'Sir Marcus Bell', role: '"C" — Chief of SIS', faction: 'official', agenda: '', standing: 0, notes: '' }
const washington: ForeignCapital = { id: 'cap0', name: 'Washington', read: -25, posture: '', lastUpdatedWeek: 1 }
const paris: ForeignCapital = { id: 'cap1', name: 'Paris', read: 10, posture: '', lastUpdatedWeek: 1 }

function loop(partial: Partial<OpenLoop>): OpenLoop {
  return { id: 'l', who: '', title: '', detail: '', commissionedWeek: 1, dueWeek: 2, status: 'commissioned', resolutionNote: '', ...partial }
}

describe('actorAliases', () => {
  it('pulls last name, role words and department synonyms', () => {
    const a = actorAliases(chancellor)
    expect(a).toContain('beaumont')
    expect(a).toContain('chancellor')
    expect(a).toContain('exchequer')
    expect(a).toContain('treasury')
  })
  it('captures a quoted single-letter codename', () => {
    expect(actorAliases(sis)).toContain('c')
    expect(actorAliases(sis)).toContain('sis')
  })
})

describe('loopsForActor', () => {
  const loops = [
    loop({ id: 'a', who: 'Treasury', title: 'Model the winter cap' }),
    loop({ id: 'b', who: 'Home Office', title: 'Returns deal' }),
    loop({ id: 'c', who: 'C', title: 'Find the leaker' }),
    loop({ id: 'd', who: 'Comms', title: 'Grid the announcement' }),
  ]
  it('ties a department-owner loop to the right minister', () => {
    expect(loopsForActor(loops, chancellor).map((l) => l.id)).toEqual(['a'])
    expect(loopsForActor(loops, home).map((l) => l.id)).toEqual(['b'])
  })
  it('matches the "C" codename as a whole word only', () => {
    expect(loopsForActor(loops, sis).map((l) => l.id)).toEqual(['c'])
  })
  it('ignores terminal (closed) loops', () => {
    const closed = [loop({ id: 'x', who: 'Treasury', title: 'done', status: 'delivered' })]
    expect(loopsForActor(closed, chancellor)).toHaveLength(0)
  })
})

describe('loopsForCapital', () => {
  const loops = [
    loop({ id: 'a', who: 'FCDO', title: 'Sound out Washington on tariffs' }),
    loop({ id: 'b', title: 'Envoy to Paris on the defence pillar' }),
    loop({ id: 'c', title: 'Draft a Trump visit plan' }),
  ]
  it('matches by capital name and by leader name', () => {
    expect(loopsForCapital(loops, washington).map((l) => l.id).sort()).toEqual(['a', 'c'])
    expect(loopsForCapital(loops, paris).map((l) => l.id)).toEqual(['b'])
  })
})

describe('resolveLoopActor', () => {
  it('prefers a named owner (who) as a minister', () => {
    const r = resolveLoopActor(loop({ who: 'Treasury', title: 'Envoy to Paris' }), [chancellor], [], [washington, paris])
    expect(r?.kind).toBe('cast')
    if (r?.kind === 'cast') expect(r.member.id).toBe('cab0')
  })
  it('falls back to a capital named in the title', () => {
    const r = resolveLoopActor(loop({ title: 'Draft the Trump visit' }), [chancellor], [], [washington])
    expect(r?.kind).toBe('capital')
    if (r?.kind === 'capital') {
      expect(r.capital.name).toBe('Washington')
      expect(r.leader).toBe('Trump')
    }
  })
  it('returns null when nothing matches', () => {
    expect(resolveLoopActor(loop({ who: 'Palace', title: 'A royal wrinkle' }), [chancellor], [], [washington])).toBeNull()
  })
})
