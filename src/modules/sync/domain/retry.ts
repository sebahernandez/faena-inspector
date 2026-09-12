/**
 * When to try again, and when to stop trying.
 *
 * Retrying forever is as wrong as not retrying: a payload the server will
 * never accept would sit at the head of the queue burning battery and hiding
 * the real problem from the inspector. So failures are classified first.
 */

export type FailureKind =
  /** No session. Not the queue's fault — do not spend an attempt on it. */
  | 'unauthenticated'
  /** Network, timeout, 5xx. Will probably work later. */
  | 'transient'
  /** The server refused the content itself. More attempts cannot help. */
  | 'permanent'

/** After this many failed attempts an entry is parked for a human to look at. */
export const MAX_ATTEMPTS = 8

const BASE_DELAY_MS = 5_000
const MAX_DELAY_MS = 30 * 60_000

export interface HttpishError {
  status?: number
  code?: string
  message?: string
}

export function classifyFailure(error: HttpishError): FailureKind {
  const status = error.status
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()

  // Postgres 42501 = insufficient_privilege. Our RPC raises it for both "not
  // authenticated" and "not a supervisor"; only the first is recoverable by
  // signing in, and the message is what tells them apart.
  if (status === 401 || message.includes('not authenticated') || message.includes('jwt')) {
    return 'unauthenticated'
  }
  if (status === 403 || code === '42501') return 'permanent'

  // No status at all means the request never reached a server.
  if (status === undefined) {
    if (message.includes('failed to fetch') || message.includes('network') || message.includes('timeout')) {
      return 'transient'
    }
    return 'transient'
  }

  if (status >= 500) return 'transient'
  if (status === 408 || status === 429) return 'transient'
  return 'permanent'
}

/**
 * Exponential backoff with jitter.
 *
 * The jitter matters more than it looks: a whole crew drives out of a dead zone
 * at the same moment, and without it every phone would hit the server on the
 * same second.
 */
export function nextDelayMs(attempts: number, random: () => number = Math.random): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS)
  const jitter = 0.5 + random() * 0.5 // 50%–100% of the window
  return Math.round(exponential * jitter)
}

export const isExhausted = (attempts: number): boolean => attempts >= MAX_ATTEMPTS
