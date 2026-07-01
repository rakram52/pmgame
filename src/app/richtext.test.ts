import { describe, it, expect } from 'vitest'
import { classifyDoc } from './richtext'
import { initialsOf } from './portrait'

describe('document classification (US-401)', () => {
  it('classifies wires, flashes, memos and front pages by label', () => {
    expect(classifyDoc('Reuters wire')).toBe('wire')
    expect(classifyDoc('PA Media')).toBe('wire')
    expect(classifyDoc('FCDO flash, B2')).toBe('flash')
    expect(classifyDoc('COBRA sitrep')).toBe('flash')
    expect(classifyDoc('PPS note')).toBe('note')
    expect(classifyDoc('Cabinet Office memo')).toBe('note')
    expect(classifyDoc('The Sun')).toBe('frontpage')
    expect(classifyDoc('Guardian splash')).toBe('frontpage')
  })

  it('falls back to a generic doc for unknown labels', () => {
    expect(classifyDoc('Overheard in the tearoom')).toBe('doc')
  })

  it('treats a bare intelligence grade as a flash', () => {
    expect(classifyDoc('C3')).toBe('flash')
  })
})

describe('portrait initials (US-402)', () => {
  it('derives stable initials, including single-word / quoted codenames', () => {
    expect(initialsOf('Rachel Beaumont')).toBe('RB')
    expect(initialsOf('"C"')).toBe('C')
    expect(initialsOf('Xi')).toBe('XI')
    expect(initialsOf('Sir Marcus Bell')).toBe('SB')
  })
})
