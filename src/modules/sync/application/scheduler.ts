import { drainOutbox, type DrainDeps, type DrainResult } from './drain-outbox'

export interface SchedulerDeps extends DrainDeps {
  /** Cheap hint only. `navigator.onLine` is true on wifi with no internet. */
  isOnline: () => boolean
  /** Fallback tick while the app is open. */
  intervalMs?: number
}

export interface SyncScheduler {
  start(): void
  stop(): void
  /** Runs now if nothing else is running. Resolves with what happened. */
  syncNow(): Promise<DrainResult | 'busy'>
  subscribe(listener: (result: DrainResult) => void): () => void
}

const IDLE: DrainResult = { uploaded: 0, rescheduled: 0, parked: 0, skipped: null }

/**
 * Decides *when* to drain.
 *
 * iOS has no background sync: a phone in a pocket will not upload, no matter
 * what we register. So every trigger here is something that happens while the
 * app is open, and the app is designed around that rather than pretending
 * otherwise.
 */
export function createSyncScheduler(deps: SchedulerDeps): SyncScheduler {
  const listeners = new Set<(r: DrainResult) => void>()
  let running = false
  let timer: ReturnType<typeof setInterval> | undefined
  let stopped = true

  const syncNow = async (): Promise<DrainResult | 'busy'> => {
    // One drain at a time. Overlapping runs would read the same due entries
    // twice and upload them twice — harmless thanks to the idempotent RPC, but
    // it doubles the traffic of a phone that already has poor signal.
    if (running) return 'busy'
    if (!deps.isOnline()) return IDLE

    running = true
    try {
      const result = await drainOutbox(deps)
      for (const listener of listeners) listener(result)
      return result
    } finally {
      running = false
    }
  }

  const trigger = () => void syncNow()

  const onVisible = () => {
    if (document.visibilityState === 'visible') trigger()
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      window.addEventListener('online', trigger)
      document.addEventListener('visibilitychange', onVisible)
      timer = setInterval(trigger, deps.intervalMs ?? 60_000)
      trigger() // whatever is pending should leave as soon as the app opens
    },

    stop() {
      stopped = true
      window.removeEventListener('online', trigger)
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    },

    syncNow,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
