import { GameStateSchema, SCHEMA_VERSION, type GameState } from './schema'

/**
 * Bring a persisted or imported blob up to the current schema. Zod defaults fill
 * any newly-added fields, so forward-compatible additions migrate for free. Add
 * explicit steps here when a breaking change lands.
 */
export function migrate(raw: unknown): GameState {
  const obj = (raw ?? {}) as Record<string, unknown>
  const from = typeof obj.schemaVersion === 'number' ? (obj.schemaVersion as number) : 0

  let working = obj
  // Example future step:
  // if (from < 2) working = stepV1toV2(working)

  const parsed = GameStateSchema.parse({ ...working, schemaVersion: SCHEMA_VERSION })
  if (from > SCHEMA_VERSION) {
    throw new Error(`Save is from a newer version (v${from}) than this app supports (v${SCHEMA_VERSION}).`)
  }
  return parsed
}
