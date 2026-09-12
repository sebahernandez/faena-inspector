import { db as defaultDb, type FaenaDB } from '@/shared/db/db'
import { toSubmitPayload } from '@/modules/inspection/application/submit-payload'
import type { SyncSourceRepository } from '../application/ports'

export function createDexieSyncSource(db: FaenaDB = defaultDb): SyncSourceRepository {
  return {
    async loadForUpload(inspectionId) {
      const row = await db.inspections.get(inspectionId)
      if (!row) return null

      const answers = await db.answers.where('inspectionId').equals(inspectionId).toArray()
      const { declaredSignature: _s, ...inspection } = row
      // The path is filled in by the worker after the upload succeeds.
      return toSubmitPayload(inspection, answers, null)
    },

    /**
     * The signature blob is released here: it now lives in Storage, and a
     * phone that keeps every signature it ever drew fills its quota.
     */
    async markSynced(inspectionId) {
      await db.transaction('rw', db.inspections, async () => {
        await db.inspections.update(inspectionId, {
          syncState: 'synced',
          declaredSignature: null,
          updatedAt: new Date().toISOString(),
        })
      })
    },
  }
}
