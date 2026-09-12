import { classifyFailure, isExhausted, nextDelayMs, type HttpishError } from '../domain/retry'
import type { Clock, OutboxRepository, RemoteGateway, SyncSourceRepository } from './ports'

export interface DrainDeps {
  outbox: OutboxRepository
  remote: RemoteGateway
  source: SyncSourceRepository
  clock: Clock
  random?: () => number
}

export interface DrainResult {
  uploaded: number
  rescheduled: number
  parked: number
  skipped: 'not-configured' | 'signed-out' | null
}

/**
 * Empties the outbox once.
 *
 * Three rules shape this:
 *
 *  1. **Never in parallel.** Entries go one at a time, oldest first. Twenty
 *     simultaneous uploads from a phone on one bar of signal is how you get
 *     twenty timeouts instead of one success.
 *  2. **A bad entry must not block the queue.** A permanent failure is parked
 *     and the drain moves on. Otherwise one malformed row stops every later
 *     inspection from ever reaching the server.
 *  3. **Signing out is not a failure.** Without a session nothing is attempted
 *     and no attempt is spent, so a locked-out phone does not burn through its
 *     retry budget and park perfectly good work.
 */
export async function drainOutbox(deps: DrainDeps): Promise<DrainResult> {
  const result: DrainResult = { uploaded: 0, rescheduled: 0, parked: 0, skipped: null }

  if (!(await deps.remote.canSync())) {
    result.skipped = 'signed-out'
    return result
  }

  const due = await deps.outbox.due(deps.clock.now())

  for (const entry of due) {
    try {
      if (entry.kind === 'photo') {
        const photo = await deps.source.loadPhotoForUpload(entry.entityId)

        // Deleted from the draft before it ever left, or already uploaded.
        if (!photo) {
          await deps.outbox.remove(entry.seq)
          continue
        }

        const path = await deps.remote.uploadPhoto(photo)
        await deps.source.markPhotoSynced(entry.entityId, path)
        await deps.outbox.remove(entry.seq)
        result.uploaded++
        continue
      }

      const payload = await deps.source.loadForUpload(entry.entityId)

      // The inspection is gone from this device. Nothing to upload and nothing
      // to retry — drop the entry instead of failing forever.
      if (!payload) {
        await deps.outbox.remove(entry.seq)
        continue
      }

      const signaturePath = await deps.remote.uploadSignature(entry.entityId)
      payload.inspection.declared_signature_path = signaturePath

      await deps.remote.submitInspection(payload)

      // Only now: the server accepted it. The RPC is idempotent, so if the
      // connection dropped after the server committed but before we heard back,
      // the next attempt is a harmless no-op rather than a duplicate.
      await deps.source.markSynced(entry.entityId)
      await deps.outbox.remove(entry.seq)
      result.uploaded++
    } catch (error) {
      const kind = classifyFailure(error as HttpishError)
      const message = error instanceof Error ? error.message : String(error)

      if (kind === 'unauthenticated') {
        result.skipped = 'signed-out'
        return result // stop the whole drain; no attempt is spent
      }

      const attempts = entry.attempts + 1

      if (kind === 'permanent' || isExhausted(attempts)) {
        await deps.outbox.park(entry.seq, message)
        result.parked++
        continue // a poisoned entry must not block the ones behind it
      }

      const delay = nextDelayMs(attempts, deps.random)
      const nextAt = new Date(deps.clock.now().getTime() + delay).toISOString()
      await deps.outbox.reschedule(entry.seq, nextAt, message)
      result.rescheduled++
    }
  }

  return result
}
