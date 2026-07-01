/** HTTP-level failure from a model provider, carrying the status so the caller
 *  can decide whether to retry the same model, fall back to another, or give up. */
export class LlmHttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'LlmHttpError'
    this.status = status
  }
  /** Rate-limit / timeout / server errors — worth a retry or a fallback model. */
  get transient(): boolean {
    return this.status === 429 || this.status === 408 || this.status >= 500
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException ? e.name === 'AbortError' : (e as { name?: string })?.name === 'AbortError'
}

/** A short, actionable message for the player when a model call ultimately fails. */
export function describeLlmError(e: unknown): string {
  if (isAbortError(e)) return 'Cancelled.'
  if (e instanceof LlmHttpError) {
    if (e.status === 429)
      return 'The free models are rate-limited right now. Wait a minute and retry, add your own OpenRouter key for higher limits (Menu → Connection), or use copy-paste for this turn.'
    if (e.status === 401 || e.status === 403) return 'The provider rejected the API key — check it in Menu → Connection.'
    if (e.status === 404) return 'That model is unavailable (it may have been retired). Pick another in Menu → Connection.'
  }
  return (e as Error)?.message || 'Unknown error.'
}
