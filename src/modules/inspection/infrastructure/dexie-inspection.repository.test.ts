/**
 * Integration tests against a REAL Dexie instance, running on fake-indexeddb.
 *
 * These prove the two things a fake repository cannot: that the submit
 * transaction is atomic, and that the outbox cannot queue the same work twice.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type FaenaDB } from '@/shared/db/db'
import type { Inspection } from '../domain/inspection'
import {
  createDexieInspectionRepository,
  listDrafts,
  listFindings,
  listPendingUpload,
  toBlob,
} from './dexie-inspection.repository'

let db: FaenaDB
let repository: ReturnType<typeof createDexieInspectionRepository>
let counter = 0

const draft = (overrides: Partial<Inspection> = {}): Inspection => ({
  id: `insp-${++counter}`,
  templateId: 'tpl-camion-multiuso',
  templateVersion: 1,
  vehicleType: 'Camión multiuso',
  plate: 'ABCD12',
  brand: null,
  model: null,
  year: null,
  driverName: null,
  odometerKm: null,
  inspectedAt: '2026-03-01T12:00:00.000Z',
  generalObservations: null,
  declaredByName: null,
  declaredByRole: null,
  declaredAt: null,
  approvedByName: null,
  approvedAt: null,
  status: 'draft',
  syncState: 'local',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
  ...overrides,
})

beforeEach(async () => {
  db = createTestDb(`test-${Date.now()}-${Math.random()}`)
  await db.open()
  repository = createDexieInspectionRepository(db)
})

afterEach(async () => {
  await db.delete()
})

describe('persistence', () => {
  it('stores and reads back an inspection', async () => {
    const inspection = draft()
    await repository.create(inspection)

    expect(await repository.find(inspection.id)).toEqual(inspection)
  })

  it('returns null for an unknown id', async () => {
    expect(await repository.find('nope')).toBeNull()
  })

  it('does not leak the signature blob into the domain object', async () => {
    const inspection = draft()
    await repository.create(inspection)

    const found = await repository.find(inspection.id)
    expect(found).not.toHaveProperty('declaredSignature')
  })
})

describe('answers', () => {
  it('upserts on the compound key instead of duplicating', async () => {
    const inspection = draft()
    await repository.create(inspection)

    const base = {
      inspectionId: inspection.id,
      itemId: 'item-1-1',
      observation: null,
      responsible: null,
      dueDate: null,
      updatedAt: '2026-03-01T12:00:00.000Z',
    }

    await repository.putAnswer({ ...base, value: 'YES' })
    await repository.putAnswer({ ...base, value: 'NO' })

    const answers = await repository.listAnswers(inspection.id)
    expect(answers).toHaveLength(1)
    expect(answers[0]?.value).toBe('NO')
  })

  it('finds findings through the compound index', async () => {
    const inspection = draft()
    await repository.create(inspection)

    const base = {
      inspectionId: inspection.id,
      observation: null,
      responsible: null,
      dueDate: null,
      updatedAt: '2026-03-01T12:00:00.000Z',
    }
    await repository.putAnswer({ ...base, itemId: 'a', value: 'YES' })
    await repository.putAnswer({ ...base, itemId: 'b', value: 'NO' })
    await repository.putAnswer({ ...base, itemId: 'c', value: 'NO' })
    await repository.putAnswer({ ...base, itemId: 'd', value: 'NA' })

    const findings = await listFindings(inspection.id, db)
    expect(findings.map((f) => f.itemId).sort()).toEqual(['b', 'c'])
  })
})

describe('submit', () => {
  const signature = new Blob(['png-bytes'], { type: 'image/png' })

  it('writes header, signature and outbox entry together', async () => {
    const inspection = draft()
    await repository.create(inspection)

    await repository.submit(inspection.id, signature, { name: 'J. Pérez', role: 'Operador' })

    const stored = await db.inspections.get(inspection.id)
    expect(stored?.status).toBe('submitted')
    expect(stored?.syncState).toBe('queued')
    expect(stored?.declaredByName).toBe('J. Pérez')
    expect(stored?.declaredSignature?.mimeType).toBe('image/png')
    expect(stored?.declaredSignature?.bytes.byteLength).toBeGreaterThan(0)

    const queued = await db.outbox.toArray()
    expect(queued).toHaveLength(1)
    expect(queued[0]?.dedupeKey).toBe(`inspection:${inspection.id}`)
  })

  it('rebuilds the signature as a Blob on the way out', async () => {
    const inspection = draft()
    await repository.create(inspection)
    await repository.submit(inspection.id, signature, { name: 'J. Pérez', role: null })

    const stored = await db.inspections.get(inspection.id)
    const rebuilt = toBlob(stored!.declaredSignature!)
    expect(rebuilt.type).toBe('image/png')
    expect(await rebuilt.text()).toBe('png-bytes')
  })

  it('rolls back completely when the transaction fails', async () => {
    const inspection = draft({ status: 'submitted' })
    await repository.create(inspection)

    await expect(
      repository.submit(inspection.id, signature, { name: 'J. Pérez', role: null }),
    ).rejects.toThrow()

    // Nothing half-written: no outbox entry, status untouched.
    expect(await db.outbox.count()).toBe(0)
    expect((await db.inspections.get(inspection.id))?.declaredByName).toBeNull()
  })

  it('cannot queue the same inspection twice — the dedupe key is unique', async () => {
    const inspection = draft()
    await repository.create(inspection)
    await repository.submit(inspection.id, signature, { name: 'J. Pérez', role: null })

    // Force the second attempt past the status guard to hit the unique index.
    await db.inspections.update(inspection.id, { status: 'draft' })
    await expect(
      repository.submit(inspection.id, signature, { name: 'J. Pérez', role: null }),
    ).rejects.toThrow()

    expect(await db.outbox.count()).toBe(1)
  })
})

describe('queries', () => {
  it('lists drafts and pending uploads separately', async () => {
    await repository.create(draft({ plate: 'AAA111' }))
    const toSubmit = draft({ plate: 'BBB222' })
    await repository.create(toSubmit)
    await repository.submit(toSubmit.id, new Blob(['x']), { name: 'J. Pérez', role: null })

    expect((await listDrafts(db)).map((i) => i.plate)).toEqual(['AAA111'])
    expect((await listPendingUpload(db)).map((i) => i.plate)).toEqual(['BBB222'])
  })
})
