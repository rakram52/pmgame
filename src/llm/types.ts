/** A configured way to reach a model directly from the browser. `apiType`
 *  selects the adapter; everything else is provider-specific config the user
 *  sets once in Settings. Stored on-device only (never in exported saves). */
export interface Connection {
  apiType: 'openai' | 'anthropic'
  baseUrl: string
  apiKey: string
  model: string
  /** When false, the app uses the copy-paste relay instead of calling the API. */
  enabled: boolean
  /** Which preset it was built from (for the Settings dropdown). */
  presetId?: string
}

export const EMPTY_CONNECTION: Connection = {
  apiType: 'openai',
  baseUrl: '',
  apiKey: '',
  model: '',
  enabled: false,
  presetId: 'openrouter',
}
