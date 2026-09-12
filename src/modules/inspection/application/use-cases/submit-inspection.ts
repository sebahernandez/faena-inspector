import { isComplete, isEditable } from '../../domain/inspection'
import type { Clock, DeclaredBy, InspectionRepository } from '../ports'
import { InspectionNotEditableError, InspectionNotFoundError } from './answer-item'

export interface SubmitInspectionInput {
  inspectionId: string
  signature: Blob
  declaredBy: DeclaredBy
  /** Total items in the frozen template version. */
  totalItems: number
}

export interface SubmitInspectionDeps {
  repository: InspectionRepository
  clock: Clock
}

export class IncompleteInspectionError extends Error {
  constructor(answered: number, total: number) {
    super(`Inspection is incomplete: ${answered} of ${total} items answered`)
    this.name = 'IncompleteInspectionError'
  }
}

/**
 * Signs and submits.
 *
 * Note what is absent: there is no network call. Submitting is a LOCAL fact.
 * The upload belongs to the sync worker, later, whenever there is signal.
 *
 * If an `await fetch` ever appears in this function, the product is broken.
 */
export async function submitInspection(
  input: SubmitInspectionInput,
  deps: SubmitInspectionDeps,
): Promise<void> {
  const inspection = await deps.repository.find(input.inspectionId)
  if (!inspection) throw new InspectionNotFoundError(input.inspectionId)
  if (!isEditable(inspection)) throw new InspectionNotEditableError(input.inspectionId)

  const answers = await deps.repository.listAnswers(input.inspectionId)
  if (!isComplete(answers, input.totalItems)) {
    throw new IncompleteInspectionError(answers.length, input.totalItems)
  }

  await deps.repository.submit(input.inspectionId, input.signature, input.declaredBy)
}
