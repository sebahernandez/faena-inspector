/**
 * Ports — what the application layer needs from the outside world.
 *
 * These are interfaces only. The implementations live in infrastructure/ and
 * the domain never sees them, so use cases can be tested in milliseconds with
 * no browser, no database and no network.
 */
import type { Answer, Inspection } from '../domain/inspection'
import type { InspectionDocument } from './inspection-document'
import type { Template } from '@/modules/template/domain/template'

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
  /** The declaring signature, rebuilt as a Blob. Null until signed. */
  findSignature(id: string): Promise<Blob | null>
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

/**
 * Turns a document into a PDF.
 *
 * Must work with no network: the inspector signs in the field and gets the
 * file right there. That is what keeps a signed document safe even if the
 * browser later evicts local storage.
 */
export interface PdfExporter {
  render(document: InspectionDocument, signatures: DocumentSignatures): Promise<Blob>
}

export interface DocumentSignatures {
  declared: Blob | null
  approved: Blob | null
}

/** Just enough of the template store for the inspection module to print. */
export interface TemplateReader {
  find(id: string): Promise<Template | null>
}
