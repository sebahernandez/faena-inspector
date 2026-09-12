import type { SubmitPayload } from '@/modules/inspection/application/submit-payload'

export interface OutboxEntry {
  seq: number
  dedupeKey: string
  kind: 'inspection' | 'photo'
  entityId: string
  attempts: number
  nextAttemptAt: string
  lastError: string | null
}

export interface OutboxRepository {
  /** Entries whose turn has come, oldest first. Parked ones are excluded. */
  due(now: Date): Promise<OutboxEntry[]>
  remove(seq: number): Promise<void>
  reschedule(seq: number, nextAttemptAt: string, lastError: string): Promise<void>
  park(seq: number, lastError: string): Promise<void>
  countPending(): Promise<number>
  countParked(): Promise<number>
}

export interface RemoteGateway {
  /** True only when a project is configured AND somebody is signed in. */
  canSync(): Promise<boolean>
  /** Uploads the signature and returns its storage path, or null if none. */
  uploadSignature(inspectionId: string): Promise<string | null>
  submitInspection(payload: SubmitPayload): Promise<void>
}

export interface SyncSourceRepository {
  /** Everything needed to build the payload, or null if the row is gone. */
  loadForUpload(inspectionId: string): Promise<SubmitPayload | null>
  markSynced(inspectionId: string): Promise<void>
}

export interface Clock {
  now(): Date
}
