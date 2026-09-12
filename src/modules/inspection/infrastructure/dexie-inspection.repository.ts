/**
 * Dexie implementation of the InspectionRepository port.
 *
 * The domain and application layers never import this file — they only know
 * the interface. Swapping Dexie for something else would not touch them.
 */
import type { Answer, Inspection } from '../domain/inspection'
import type { DeclaredBy, InspectionRepository } from '../application/ports'
import { db as defaultDb, type FaenaDB, type StoredBytes, type StoredInspection } from '@/shared/db/db'

const strip = ({ declaredSignature: _signature, ...inspection }: StoredInspection): Inspection =>
  inspection

/** Blob in, raw bytes out. See StoredBytes for why. */
const toStoredBytes = async (blob: Blob): Promise<StoredBytes> => ({
  bytes: await blob.arrayBuffer(),
  mimeType: blob.type || 'application/octet-stream',
})

export const toBlob = (stored: StoredBytes): Blob =>
  new Blob([stored.bytes], { type: stored.mimeType })

export function createDexieInspectionRepository(db: FaenaDB = defaultDb): InspectionRepository {
  return {
    async create(inspection) {
      await db.inspections.add({ ...inspection, declaredSignature: null })
    },

    async find(id) {
      const row = await db.inspections.get(id)
      return row ? strip(row) : null
    },

    async update(id, patch) {
      await db.inspections.update(id, patch)
    },

    async putAnswer(answer) {
      await db.answers.put(answer)
    },

    async listAnswers(inspectionId) {
      return db.answers.where('inspectionId').equals(inspectionId).toArray()
    },

    /**
     * Header, signature and outbox entry are written together.
     *
     * If the phone dies mid-write, a half-submitted inspection must not
     * survive — so all three happen inside one transaction. All or nothing.
     */
    async submit(id: string, signature: Blob, declaredBy: DeclaredBy) {
      const now = new Date().toISOString()
      // Read the blob BEFORE opening the transaction: an await on anything
      // other than Dexie inside a transaction drops out of its scope.
      const storedSignature = await toStoredBytes(signature)

      await db.transaction('rw', db.inspections, db.outbox, async () => {
        const current = await db.inspections.get(id)
        if (!current) throw new Error(`Inspection ${id} not found`)
        if (current.status !== 'draft') throw new Error('Only drafts can be submitted')

        await db.inspections.update(id, {
          declaredByName: declaredBy.name,
          declaredByRole: declaredBy.role,
          declaredSignature: storedSignature,
          declaredAt: now,
          status: 'submitted',
          syncState: 'queued',
          updatedAt: now,
        })

        await db.outbox.put({
          dedupeKey: `inspection:${id}`, // unique index: cannot be queued twice
          kind: 'inspection',
          entityId: id,
          attempts: 0,
          nextAttemptAt: now,
          lastError: null,
          createdAt: now,
        })
      })
    },
  }
}

// ---------------------------------------------------------------------------
// Queries used by the UI through useLiveQuery. Reads only.
// ---------------------------------------------------------------------------

export const listDrafts = (db: FaenaDB = defaultDb) =>
  db.inspections.where('status').equals('draft').reverse().sortBy('updatedAt')

export const listPendingUpload = (db: FaenaDB = defaultDb) =>
  db.inspections.where('[status+syncState]').equals(['submitted', 'queued']).toArray()

/**
 * Findings = every NO. Not a separate table: a NO IS a finding.
 *
 * Duplicating them would mean that the day the two drift apart, the
 * supervisor's dashboard lies. The [inspectionId+value] compound index makes
 * this an index lookup instead of a scan.
 */
export const listFindings = (inspectionId: string, db: FaenaDB = defaultDb): Promise<Answer[]> =>
  db.answers.where('[inspectionId+value]').equals([inspectionId, 'NO']).toArray()
