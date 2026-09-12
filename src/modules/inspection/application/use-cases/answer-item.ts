import { isEditable, type Answer, type AnswerValue } from '../../domain/inspection'
import type { Clock, InspectionRepository } from '../ports'

export interface AnswerItemInput {
  inspectionId: string
  itemId: string
  value: AnswerValue
  observation?: string | null
  responsible?: string | null
  dueDate?: string | null
}

export interface AnswerItemDeps {
  repository: InspectionRepository
  clock: Clock
}

export class InspectionNotFoundError extends Error {
  constructor(id: string) {
    super(`Inspection ${id} not found`)
    this.name = 'InspectionNotFoundError'
  }
}

export class InspectionNotEditableError extends Error {
  constructor(id: string) {
    super(`Inspection ${id} is submitted and cannot be edited`)
    this.name = 'InspectionNotEditableError'
  }
}

/**
 * Records one answer. One tap writes one small row.
 *
 * Answers are a separate table precisely so this does not rewrite the whole
 * 51-item document on every tap — on a mid-range phone that is the difference
 * between instant and sluggish.
 */
export async function answerItem(input: AnswerItemInput, deps: AnswerItemDeps): Promise<Answer> {
  const inspection = await deps.repository.find(input.inspectionId)
  if (!inspection) throw new InspectionNotFoundError(input.inspectionId)
  if (!isEditable(inspection)) throw new InspectionNotEditableError(input.inspectionId)

  const answer: Answer = {
    inspectionId: input.inspectionId,
    itemId: input.itemId,
    value: input.value,
    // A NO carries an owner and a deadline. Anything else clears them.
    observation: input.value === 'NO' ? (input.observation ?? null) : null,
    responsible: input.value === 'NO' ? (input.responsible ?? null) : null,
    dueDate: input.value === 'NO' ? (input.dueDate ?? null) : null,
    updatedAt: deps.clock.now().toISOString(),
  }

  await deps.repository.putAnswer(answer)
  await deps.repository.update(input.inspectionId, { updatedAt: answer.updatedAt })
  return answer
}
