import { describe, it, expect } from 'vitest'
import { decayOpenLoops, loopsComingDueSoon, LOOP_STALL_AFTER, LOOP_LAPSE_AFTER } from './loops'
import type { OpenLoop } from '../state/schema'

function loop(over: Partial<OpenLoop> = {}): OpenLoop {
  return { id: 'l1', who: 'Cabinet Office', title: 'Model the crime-funding options', detail: '', commissionedWeek: 1, dueWeek: 5, status: 'in-progress', resolutionNote: '', ...over }
}

describe('decayOpenLoops — loops with teeth', () => {
  it('leaves a loop that is not yet overdue alone', () => {
    const week = 5 + LOOP_STALL_AFTER - 1
    const { loops, injections } = decayOpenLoops([loop({ dueWeek: 5 })], week)
    expect(loops[0].status).toBe('in-progress')
    expect(injections).toHaveLength(0)
  })

  it('stalls a live tasking left past its deadline, and flags it', () => {
    const week = 5 + LOOP_STALL_AFTER
    const { loops, injections } = decayOpenLoops([loop({ dueWeek: 5, status: 'commissioned' })], week)
    expect(loops[0].status).toBe('stalled')
    expect(injections[0]).toMatch(/SLIPPING/)
  })

  it('lapses a tasking neglected far past its deadline (terminal + fallout)', () => {
    const week = 5 + LOOP_LAPSE_AFTER
    const { loops, injections } = decayOpenLoops([loop({ dueWeek: 5 })], week)
    expect(loops[0].status).toBe('failed')
    expect(loops[0].resolutionNote).toMatch(/Lapsed/)
    expect(injections[0]).toMatch(/LAPSED/)
  })

  it('lapses an already-stalled loop once it is far enough past due', () => {
    const week = 5 + LOOP_LAPSE_AFTER
    const { loops } = decayOpenLoops([loop({ dueWeek: 5, status: 'stalled' })], week)
    expect(loops[0].status).toBe('failed')
  })

  it('does not re-fire on a loop already sitting stalled but not yet lapsable', () => {
    const week = 5 + LOOP_STALL_AFTER // stalled range, below lapse
    const { loops, injections } = decayOpenLoops([loop({ dueWeek: 5, status: 'stalled' })], week)
    expect(loops[0].status).toBe('stalled')
    expect(injections).toHaveLength(0)
  })

  it('never decays a terminal loop, or a deliberate buried/leaked outcome', () => {
    const week = 20
    const delivered = decayOpenLoops([loop({ dueWeek: 5, status: 'delivered' })], week)
    expect(delivered.loops[0].status).toBe('delivered')
    expect(delivered.injections).toHaveLength(0)

    const buried = decayOpenLoops([loop({ dueWeek: 5, status: 'buried' })], week)
    expect(buried.loops[0].status).toBe('buried')
    expect(buried.injections).toHaveLength(0)
  })
})

describe('loopsComingDueSoon', () => {
  it('surfaces live loops approaching their deadline but not yet due', () => {
    const loops = [
      loop({ id: 'due-now', dueWeek: 5 }),
      loop({ id: 'soon', dueWeek: 6 }),
      loop({ id: 'far', dueWeek: 20 }),
      loop({ id: 'done', dueWeek: 6, status: 'delivered' }),
    ]
    const soon = loopsComingDueSoon(loops, 5).map((l) => l.id)
    expect(soon).toContain('soon')
    expect(soon).not.toContain('due-now') // already due — handled by the DUE section
    expect(soon).not.toContain('far')
    expect(soon).not.toContain('done')
  })
})
