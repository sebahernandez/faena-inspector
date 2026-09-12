import { db as defaultDb, type FaenaDB } from '@/shared/db/db'
import type { OutboxEntry, OutboxRepository } from '../application/ports'

export function createDexieOutboxRepository(db: FaenaDB = defaultDb): OutboxRepository {
  return {
    /**
     * FIFO by `seq`, which auto-increments — so entries leave in the order the
     * inspector created them. Parked entries are excluded: they are waiting on
     * a person, not on the clock.
     */
    async due(now: Date): Promise<OutboxEntry[]> {
      const iso = now.toISOString()
      const rows = await db.outbox.orderBy('seq').toArray()
      return rows
        .filter((r) => r.parked !== 1 && r.nextAttemptAt <= iso)
        .map((r) => ({
          seq: r.seq!,
          dedupeKey: r.dedupeKey,
          kind: r.kind,
          entityId: r.entityId,
          attempts: r.attempts,
          nextAttemptAt: r.nextAttemptAt,
          lastError: r.lastError,
        }))
    },

    async remove(seq) {
      await db.outbox.delete(seq)
    },

    async reschedule(seq, nextAttemptAt, lastError) {
      const row = await db.outbox.get(seq)
      if (!row) return
      await db.outbox.update(seq, { attempts: row.attempts + 1, nextAttemptAt, lastError })
    },

    async park(seq, lastError) {
      await db.outbox.update(seq, { parked: 1, lastError })
    },

    async countPending() {
      return db.outbox.filter((r) => r.parked !== 1).count()
    },

    async countParked() {
      return db.outbox.filter((r) => r.parked === 1).count()
    },
  }
}
