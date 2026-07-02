import { describe, it, expect } from 'vitest'
import { migrate } from './migrations'
import { initGameState } from '../setup/init'
import { SCHEMA_VERSION } from './schema'

const SEL = {
  pmName: 'Old Save PM',
  offices: { chancellor: 'Rachel Beaumont', foreign: 'Marcus Reeve', home: 'Karen Blythe', defence: 'Iain McBride' },
  innerMachine: { whip: 'Frank Dolan', cabinetOffice: 'Paul Grieve', comms: 'Fiona Blake', pps: 'Alice Fenn' },
  secondTierTheme: 'balance',
  doctrine: { immigration: 'A', economy: 'B', nhs: 'B', costOfLiving: 'A', crime: 'A', housing: 'B', atlanticEurope: 'B', defence: 'A', reformStrategy: 'A' },
}

describe('migrations (FR-16 — old saves keep loading)', () => {
  it('a v1 save (no set-piece / history fields) migrates with safe defaults', () => {
    const full = initGameState(SEL, 'mig-seed') as Record<string, unknown>
    // Simulate an old blob: strip everything added since v1, mark it v1.
    delete full.turnKind
    delete full.queuedTurnKind
    delete full.setpieceHistory
    delete full.setpieceContext
    delete full.activeScene
    delete full.statHistory
    delete full.ending
    delete full.lastAction
    full.schemaVersion = 1

    const migrated = migrate(full)
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.turnKind).toBe('standard')
    expect(migrated.queuedTurnKind).toBeNull()
    expect(migrated.setpieceHistory).toEqual([])
    expect(migrated.setpieceContext).toBe('')
    expect(migrated.activeScene).toBeNull()
    expect(migrated.statHistory).toEqual([])
    expect(migrated.ending).toBeNull()
    expect(migrated.lastAction).toBe('')
  })

  it('refuses a save from a newer version than supported', () => {
    const full = initGameState(SEL, 'mig-seed2') as Record<string, unknown>
    full.schemaVersion = SCHEMA_VERSION + 5
    expect(() => migrate(full)).toThrow(/newer version/i)
  })
})
