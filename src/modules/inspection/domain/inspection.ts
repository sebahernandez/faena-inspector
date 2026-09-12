/**
 * An inspection — one filled-in checklist for one vehicle on one date.
 *
 * Once submitted it is a legal document and is never edited again. That rule is
 * enforced twice: here, and by row-level security in Postgres. The database
 * enforcement is the one that matters, because it does not depend on this code
 * behaving well.
 */
import { z } from 'zod'

/** SI / NO / N/A in the source document. */
export const answerValueSchema = z.enum(['YES', 'NO', 'NA'])
export type AnswerValue = z.infer<typeof answerValueSchema>

/** Business lifecycle. Deliberately separate from sync state. */
export const inspectionStatusSchema = z.enum(['draft', 'submitted', 'approved'])
export type InspectionStatus = z.infer<typeof inspectionStatusSchema>

/** Technical lifecycle. Mixing this into status would allow impossible states. */
export const syncStateSchema = z.enum(['local', 'queued', 'synced'])
export type SyncState = z.infer<typeof syncStateSchema>

/**
 * One answered item.
 *
 * `responsible` and `dueDate` come straight from the source document's columns:
 * a NO is a task with an owner and a deadline, not a free-text remark.
 */
export const answerSchema = z.object({
  inspectionId: z.string().min(1),
  itemId: z.string().min(1),
  value: answerValueSchema,
  observation: z.string().nullable(),
  responsible: z.string().nullable(),
  dueDate: z.string().date().nullable(),
  updatedAt: z.string().datetime(),
})
export type Answer = z.infer<typeof answerSchema>

export const inspectionSchema = z.object({
  /** UUID v7, generated on the device so the server can upsert idempotently. */
  id: z.string().min(1),
  templateId: z.string().min(1),
  /** Frozen at creation. A signed document must reprint identically forever. */
  templateVersion: z.number().int().positive(),

  vehicleType: z.string().nullable(),
  plate: z.string().min(1),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  year: z.number().int().min(1900).max(2100).nullable(),
  driverName: z.string().nullable(),
  odometerKm: z.number().int().nonnegative().nullable(),
  inspectedAt: z.string().datetime(),

  generalObservations: z.string().nullable(),

  declaredByName: z.string().nullable(),
  declaredByRole: z.string().nullable(),
  declaredAt: z.string().datetime().nullable(),

  /** Server-owned. Arrives by pull; this device never writes it. */
  approvedByName: z.string().nullable(),
  approvedAt: z.string().datetime().nullable(),

  status: inspectionStatusSchema,
  syncState: syncStateSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type Inspection = z.infer<typeof inspectionSchema>

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export const isEditable = (inspection: Inspection): boolean => inspection.status === 'draft'

/** A finding is simply a NO. There is no separate concept and no separate table. */
export const isFinding = (answer: Answer): boolean => answer.value === 'NO'

export const countFindings = (answers: readonly Answer[]): number =>
  answers.filter(isFinding).length

export interface AnswerTally {
  yes: number
  no: number
  na: number
  answered: number
}

export const tally = (answers: readonly Answer[]): AnswerTally => {
  const yes = answers.filter((a) => a.value === 'YES').length
  const no = answers.filter((a) => a.value === 'NO').length
  const na = answers.filter((a) => a.value === 'NA').length
  return { yes, no, na, answered: yes + no + na }
}

export const isComplete = (answers: readonly Answer[], totalItems: number): boolean =>
  tally(answers).answered === totalItems
