import { db as defaultDb, type FaenaDB } from '@/shared/db/db'
import { toSubmitPayload } from '@/modules/inspection/application/submit-payload'
import { toBlob } from '@/modules/inspection/infrastructure/dexie-inspection.repository'
import { markPhotoUploaded } from '@/modules/inspection/infrastructure/dexie-photo.repository'
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

    async loadPhotoForUpload(photoId) {
      const row = await db.photos.get(photoId)
      if (!row?.image || row.uploadState !== 'pending') return null
      return {
        id: row.id,
        inspectionId: row.inspectionId,
        itemId: row.itemId,
        image: toBlob(row.image),
      }
    },

    /** Releases the bytes: they now live in Storage, and the quota is freed. */
    async markPhotoSynced(photoId, storagePath) {
      await markPhotoUploaded(photoId, storagePath, db)
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
