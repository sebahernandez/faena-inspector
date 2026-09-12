/**
 * Evidence photos.
 *
 * Photos are the one thing in this app that can genuinely exhaust a phone's
 * storage, and the browser's answer to a full quota is to start deleting —
 * which here means deleting a signed legal document. So the limits are part of
 * the domain, not an afterthought in the UI.
 */
import { z } from 'zod'

/** Enough to show a flat tyre from two angles and a close-up. More is hoarding. */
export const MAX_PHOTOS_PER_FINDING = 3

/** Readable on an A4 print without carrying a 4 MB original. */
export const MAX_IMAGE_DIMENSION = 1600
export const IMAGE_QUALITY = 0.7

/** Refuse anything larger even after compression: something went wrong. */
export const MAX_STORED_BYTES = 1_500_000

export const evidencePhotoSchema = z.object({
  id: z.string().min(1),
  inspectionId: z.string().min(1),
  itemId: z.string().min(1),
  byteSize: z.number().int().positive(),
  createdAt: z.string().datetime(),
  /** Filled once the file reaches Storage; null while it is still local. */
  storagePath: z.string().nullable(),
})
export type EvidencePhoto = z.infer<typeof evidencePhotoSchema>

export const hasRoomForPhoto = (current: number): boolean => current < MAX_PHOTOS_PER_FINDING

export const remainingSlots = (current: number): number =>
  Math.max(0, MAX_PHOTOS_PER_FINDING - current)

/**
 * Storage pressure, as the inspector should understand it.
 *
 * `critical` is not "disk almost full" — it is "the browser may start evicting
 * your signed inspections". It has to be loud well before that.
 */
export type StoragePressure = 'ok' | 'warning' | 'critical'

export function storagePressure(usageBytes: number, quotaBytes: number): StoragePressure {
  if (quotaBytes <= 0) return 'ok'
  const ratio = usageBytes / quotaBytes
  if (ratio >= 0.9) return 'critical'
  if (ratio >= 0.7) return 'warning'
  return 'ok'
}
