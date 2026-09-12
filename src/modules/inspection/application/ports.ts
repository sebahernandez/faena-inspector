/**
 * Ports — what the application layer needs from the outside world.
 *
 * These are interfaces only. The implementations live in infrastructure/ and
 * the domain never sees them, so use cases can be tested in milliseconds with
 * no browser, no database and no network.
 */
import type { Answer, Inspection } from '../domain/inspection'

export interface InspectionRepository {
  create(inspection: Inspection): Promise<void>
  find(id: string): Promise<Inspection | null>
  update(id: string, patch: Partial<Inspection>): Promise<void>
  putAnswer(answer: Answer): Promise<void>
  listAnswers(inspectionId: string): Promise<Answer[]>
  /** Writes header, signature and outbox entry in ONE transaction. */
  submit(id: string, signature: Blob, declaredBy: DeclaredBy): Promise<void>
  /** Drops a draft and its answers together. Only drafts may be discarded. */
  discard(id: string): Promise<void>
}

export interface DeclaredBy {
  name: string
  role: string | null
}

export interface Clock {
  now(): Date
}

export interface IdGenerator {
  next(): string
}
