import { beforeEach, describe, expect, it } from 'vitest'
import {
  attachEvidencePhoto,
  ImageTooLargeError,
  NotAFindingError,
  removeEvidencePhoto,
  TooManyPhotosError,
} from './attach-evidence'
import { InspectionNotEditableError } from './answer-item'
import { MAX_PHOTOS_PER_FINDING, MAX_STORED_BYTES } from '../../domain/evidence'
import type { EvidencePhoto } from '../../domain/evidence'
import type { Answer, Inspection } from '../../domain/inspection'
import type { ImageCompressor, InspectionRepository, PhotoRepository } from '../ports'

const ITEM = 'item-1-1'
const ID = 'insp-1'

let inspection: Inspection
let answers: Answer[]
let stored: { photo: EvidencePhoto; image: Blob }[]
let compressedTo: number

const inspections = {
  async find() {
    return inspection
  },
  async listAnswers() {
    return answers
  },
} as unknown as InspectionRepository

const photos: PhotoRepository = {
  async add(photo, image) {
    stored.push({ photo, image })
  },
  async listFor() {
    return stored.map((s) => s.photo)
  },
  async listForInspection() {
    return stored.map((s) => s.photo)
  },
  async countFor() {
    return stored.length
  },
  async remove(id) {
    stored = stored.filter((s) => s.photo.id !== id)
  },
  async imageOf() {
    return null
  },
}

const compressor: ImageCompressor = {
  compress: async () => new Blob([new Uint8Array(compressedTo)], { type: 'image/jpeg' }),
}

let seq = 0
const deps = {
  inspections,
  photos,
  compressor,
  clock: { now: () => new Date('2026-03-01T12:00:00.000Z') },
  ids: { next: () => `photo-${++seq}` },
}

const original = new Blob([new Uint8Array(4_000_000)], { type: 'image/jpeg' })

beforeEach(() => {
  seq = 0
  stored = []
  compressedTo = 180_000
  answers = [
    { inspectionId: ID, itemId: ITEM, value: 'NO', observation: null, responsible: null, dueDate: null, updatedAt: '' },
  ]
  inspection = { id: ID, status: 'draft' } as Inspection
})

describe('attaching evidence', () => {
  it('stores a compressed photo against the finding', async () => {
    const photo = await attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps)

    expect(photo.itemId).toBe(ITEM)
    expect(photo.storagePath).toBeNull()
    expect(stored).toHaveLength(1)
  })

  it('never lets the original reach the database', async () => {
    await attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps)

    expect(stored[0]!.image.size).toBe(180_000)
    expect(stored[0]!.image.size).toBeLessThan(original.size)
  })

  it('refuses evidence on an item that complies', async () => {
    answers[0]!.value = 'YES'
    await expect(
      attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps),
    ).rejects.toBeInstanceOf(NotAFindingError)
  })

  it('refuses evidence on an unanswered item', async () => {
    answers = []
    await expect(
      attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps),
    ).rejects.toBeInstanceOf(NotAFindingError)
  })

  it('enforces the per-finding cap', async () => {
    for (let i = 0; i < MAX_PHOTOS_PER_FINDING; i++) {
      await attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps)
    }
    await expect(
      attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps),
    ).rejects.toBeInstanceOf(TooManyPhotosError)
  })

  it('refuses an image that is still huge after compression', async () => {
    compressedTo = MAX_STORED_BYTES + 1
    await expect(
      attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps),
    ).rejects.toBeInstanceOf(ImageTooLargeError)
    expect(stored).toHaveLength(0)
  })

  it('refuses to touch a signed inspection', async () => {
    inspection = { id: ID, status: 'submitted' } as Inspection
    await expect(
      attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps),
    ).rejects.toBeInstanceOf(InspectionNotEditableError)
  })
})

describe('removing evidence', () => {
  it('removes it from a draft', async () => {
    const photo = await attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps)
    await removeEvidencePhoto(photo.id, ID, { inspections, photos })
    expect(stored).toHaveLength(0)
  })

  it('refuses once the inspection is signed — the evidence is part of the document', async () => {
    const photo = await attachEvidencePhoto({ inspectionId: ID, itemId: ITEM, file: original }, deps)
    inspection = { id: ID, status: 'submitted' } as Inspection

    await expect(
      removeEvidencePhoto(photo.id, ID, { inspections, photos }),
    ).rejects.toBeInstanceOf(InspectionNotEditableError)
    expect(stored).toHaveLength(1)
  })
})
