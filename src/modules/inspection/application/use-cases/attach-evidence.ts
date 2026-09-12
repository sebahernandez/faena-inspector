import { isEditable } from '../../domain/inspection'
import {
  hasRoomForPhoto,
  MAX_PHOTOS_PER_FINDING,
  MAX_STORED_BYTES,
  type EvidencePhoto,
} from '../../domain/evidence'
import type { Clock, IdGenerator, ImageCompressor, InspectionRepository, PhotoRepository } from '../ports'
import { InspectionNotEditableError, InspectionNotFoundError } from './answer-item'

export interface AttachEvidenceDeps {
  inspections: InspectionRepository
  photos: PhotoRepository
  compressor: ImageCompressor
  clock: Clock
  ids: IdGenerator
}

export class NotAFindingError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} is not marked NO, so it carries no evidence`)
    this.name = 'NotAFindingError'
  }
}

export class TooManyPhotosError extends Error {
  constructor() {
    super(`An item can carry at most ${MAX_PHOTOS_PER_FINDING} photos`)
    this.name = 'TooManyPhotosError'
  }
}

export class ImageTooLargeError extends Error {
  constructor(bytes: number) {
    super(`The image is still ${Math.round(bytes / 1024)} KB after compression`)
    this.name = 'ImageTooLargeError'
  }
}

/**
 * Attaches a photo to a finding.
 *
 * Evidence only belongs to a NO: a photo of something that complies is storage
 * spent for nothing, on the device where storage pressure evicts signed
 * documents.
 */
export async function attachEvidencePhoto(
  input: { inspectionId: string; itemId: string; file: File | Blob },
  deps: AttachEvidenceDeps,
): Promise<EvidencePhoto> {
  const inspection = await deps.inspections.find(input.inspectionId)
  if (!inspection) throw new InspectionNotFoundError(input.inspectionId)
  if (!isEditable(inspection)) throw new InspectionNotEditableError(input.inspectionId)

  const answers = await deps.inspections.listAnswers(input.inspectionId)
  const answer = answers.find((a) => a.itemId === input.itemId)
  if (answer?.value !== 'NO') throw new NotAFindingError(input.itemId)

  const existing = await deps.photos.countFor(input.inspectionId, input.itemId)
  if (!hasRoomForPhoto(existing)) throw new TooManyPhotosError()

  // Compress before storing, never after: the original never enters the
  // database, so a burst of 12-megapixel shots cannot fill the quota even for
  // an instant.
  const image = await deps.compressor.compress(input.file)
  if (image.size > MAX_STORED_BYTES) throw new ImageTooLargeError(image.size)

  const photo: EvidencePhoto = {
    id: deps.ids.next(),
    inspectionId: input.inspectionId,
    itemId: input.itemId,
    byteSize: image.size,
    createdAt: deps.clock.now().toISOString(),
    storagePath: null,
  }

  await deps.photos.add(photo, image)
  return photo
}

export async function removeEvidencePhoto(
  photoId: string,
  inspectionId: string,
  deps: { inspections: InspectionRepository; photos: PhotoRepository },
): Promise<void> {
  const inspection = await deps.inspections.find(inspectionId)
  if (!inspection) throw new InspectionNotFoundError(inspectionId)
  // Once signed, the evidence is part of the document.
  if (!isEditable(inspection)) throw new InspectionNotEditableError(inspectionId)

  await deps.photos.remove(photoId)
}
