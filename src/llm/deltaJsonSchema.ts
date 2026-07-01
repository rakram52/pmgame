import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { TurnDeltaSchema } from '../state/delta'

/** On the API path the narrative rides inside the JSON, so `scene` is required
 *  here (it's optional in the base schema, which also serves the copy-paste path). */
export const ApiDeltaSchema = TurnDeltaSchema.extend({ scene: z.string() })

/** JSON Schema for the Anthropic `submit_turn` tool's input_schema. Inlined
 *  (no $ref/$defs) so tool-use accepts it cleanly. */
export const DELTA_JSON_SCHEMA = zodToJsonSchema(ApiDeltaSchema, {
  $refStrategy: 'none',
  target: 'jsonSchema7',
}) as Record<string, unknown>
