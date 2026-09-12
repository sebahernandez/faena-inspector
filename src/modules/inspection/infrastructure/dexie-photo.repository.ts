import { db as defaultDb, type FaenaDB } from '@/shared/db/db'
import type { EvidencePhoto } from '../domain/evidence'
import type { PhotoRepository } from '../application/ports'
import { toBlob } from './dexie-inspection.repository'

export function createDexiePhotoRepository(db: FaenaDB = defaultDb): PhotoRepository {
  const toDomain = (row: {
    id: string
    inspectionId: string
    itemId: string
    byteSize: number
    createdAt: string
    storagePath: string | null
  }): EvidencePhoto => ({
    id: row.id,
    inspectionId: row.inspectionId,
    itemId: row.itemId,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    storagePath: row.storagePath,
  })

  return {
    async add(photo, image) {
      await db.photos.add({
        id: photo.id,
        inspectionId: photo.inspectionId,
        itemId: photo.itemId,
        image: { bytes: await image.arrayBuffer(), mimeType: image.type || 'image/jpeg' },
        byteSize: photo.byteSize,
        uploadState: 'pending',
        storagePath: null,
        createdAt: photo.createdAt,
      })
    },

    async listFor(inspectionId, itemId) {
      const rows = await db.photos.where('[inspectionId+itemId]').equals([inspectionId, itemId]).toArray()
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toDomain)
    },

    async listForInspection(inspectionId) {
      const rows = await db.photos.where('inspectionId').equals(inspectionId).toArray()
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(toDomain)
    },

    async countFor(inspectionId, itemId) {
      return db.photos.where('[inspectionId+itemId]').equals([inspectionId, itemId]).count()
    },

    async remove(photoId) {
      await db.photos.delete(photoId)
    },

    async imageOf(photoId) {
      const row = await db.photos.get(photoId)
      return row?.image ? toBlob(row.image) : null
    },
  }
}

/** Called by the sync worker: the bytes now live in Storage. */
export async function markPhotoUploaded(
  photoId: string,
  storagePath: string,
  db: FaenaDB = defaultDb,
): Promise<void> {
  await db.photos.update(photoId, { uploadState: 'uploaded', storagePath, image: null })
}

export const listPendingPhotos = (inspectionId: string, db: FaenaDB = defaultDb) =>
  db.photos.where('inspectionId').equals(inspectionId).filter((p) => p.uploadState === 'pending').toArray()
