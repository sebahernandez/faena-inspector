/**
 * The local database — the single source of truth for the inspector side.
 *
 * The server is a replica of this, never the other way around. The UI reads
 * from here and never waits for the network.
 */
import Dexie, { type Table } from 'dexie'
import type { Answer, Inspection } from '@/modules/inspection/domain/inspection'
import type { Template } from '@/modules/template/domain/template'

/**
 * Binary payloads are stored as raw bytes, never as Blob objects.
 *
 * Safari has a long history of bugs round-tripping Blobs through IndexedDB,
 * and this app targets phones we do not control. ArrayBuffer is universally
 * safe, so the adapter unwraps the Blob on the way in and rebuilds it on the
 * way out. The domain keeps working with Blob and never learns about this.
 */
export interface StoredBytes {
  bytes: ArrayBuffer
  mimeType: string
}

/** Persistence-only extras that the domain has no reason to know about. */
export interface StoredInspection extends Inspection {
  /** PNG signature. Held locally until the sync worker moves it to Storage. */
  declaredSignature: StoredBytes | null
}

export interface StoredPhoto {
  id: string
  inspectionId: string
  itemId: string
  image: StoredBytes
  uploadState: 'pending' | 'uploaded'
  storagePath: string | null
  createdAt: string
}

/**
 * Everything owed to the server.
 *
 * `seq` auto-increments, so draining in key order is FIFO.
 * `dedupeKey` is unique, so the same work cannot be queued twice.
 */
export interface OutboxEntry {
  seq?: number
  dedupeKey: string
  kind: 'inspection' | 'photo'
  entityId: string
  attempts: number
  nextAttemptAt: string
  lastError: string | null
  createdAt: string
}

export interface MetaEntry {
  key: string
  value: unknown
}

class FaenaDB extends Dexie {
  templates!: Table<Template, string>
  inspections!: Table<StoredInspection, string>
  answers!: Table<Answer, [string, string]>
  photos!: Table<StoredPhoto, string>
  outbox!: Table<OutboxEntry, number>
  meta!: Table<MetaEntry, string>

  constructor(name = 'faena-inspector') {
    super(name)

    /**
     * These strings declare the PRIMARY KEY (first entry) and the INDEXES —
     * not the shape of the stored object. Every field of the interfaces above
     * is persisted; only the ones listed here are searchable.
     *
     *   ++ auto-increment    & unique    [a+b] compound
     */
    this.version(1).stores({
      templates: 'id, [name+version], isActive',
      inspections: 'id, plate, status, syncState, inspectedAt, [status+syncState]',
      answers: '[inspectionId+itemId], inspectionId, [inspectionId+value]',
      photos: 'id, inspectionId, [inspectionId+itemId], uploadState',
      outbox: '++seq, &dedupeKey, entityId, nextAttemptAt',
      meta: 'key',
    })
  }
}

export const db = new FaenaDB()

/** Used by tests to get an isolated database per case. */
export const createTestDb = (name: string): FaenaDB => new FaenaDB(name)
export type { FaenaDB }

// ---------------------------------------------------------------------------
// Migrations — keep this note.
//
// The day a field is added there will be dozens of phones holding the old
// version, with SIGNED inspections inside. Wiping is not an option. Each device
// applies whatever it is missing on next open.
//
// db.version(2)
//   .stores({ inspections: 'id, plate, status, syncState, inspectedAt, [status+syncState], driverName' })
//   .upgrade(tx => tx.table('inspections').toCollection().modify(row => { row.driverName ??= null }))
// ---------------------------------------------------------------------------
