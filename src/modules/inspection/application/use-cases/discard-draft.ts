import { isEditable } from '../../domain/inspection'
import type { InspectionRepository } from '../ports'
import { InspectionNotEditableError, InspectionNotFoundError } from './answer-item'

/**
 * Throws away a draft.
 *
 * A submitted inspection is a legal document and can never be discarded — not
 * even by the person who wrote it.
 */
export async function discardDraft(
  inspectionId: string,
  deps: { repository: InspectionRepository },
): Promise<void> {
  const inspection = await deps.repository.find(inspectionId)
  if (!inspection) throw new InspectionNotFoundError(inspectionId)
  if (!isEditable(inspection)) throw new InspectionNotEditableError(inspectionId)

  await deps.repository.discard(inspectionId)
}
