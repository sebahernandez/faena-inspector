import { useLiveQuery } from 'dexie-react-hooks'
import { actions, queries } from '@/app/container'
import { sectionProgress, overallProgress } from '../../application/progress'
import type { AnswerValue } from '../../domain/inspection'

/**
 * Everything one inspection screen needs.
 *
 * All reads go through useLiveQuery: the local database is the state, so these
 * re-render on their own whenever anything writes — including the sync worker
 * or another tab. Nothing here waits for the network.
 */
export function useInspection(inspectionId: string) {
  const inspection = useLiveQuery(() => queries.inspection(inspectionId), [inspectionId])
  const answers = useLiveQuery(() => queries.answers(inspectionId), [inspectionId], [])
  const template = useLiveQuery(
    () => (inspection ? queries.template(inspection.templateId) : Promise.resolve(undefined)),
    [inspection?.templateId],
  )

  const loading = inspection === undefined || template === undefined
  const progress = template ? sectionProgress(template, answers) : []
  const overall = overallProgress(progress)
  const answerByItem = new Map(answers.map((a) => [a.itemId, a]))

  const answer = (itemId: string, value: AnswerValue) => {
    const existing = answerByItem.get(itemId)
    return actions.answerItem({
      inspectionId,
      itemId,
      value,
      // Keep whatever was already typed when the value stays NO.
      observation: value === 'NO' ? (existing?.observation ?? null) : null,
      responsible: value === 'NO' ? (existing?.responsible ?? null) : null,
      dueDate: value === 'NO' ? (existing?.dueDate ?? null) : null,
    })
  }

  const updateFinding = (
    itemId: string,
    patch: { observation?: string; responsible?: string; dueDate?: string },
  ) => {
    const existing = answerByItem.get(itemId)
    if (existing?.value !== 'NO') return Promise.resolve()

    return actions.answerItem({
      inspectionId,
      itemId,
      value: 'NO',
      observation: patch.observation ?? existing.observation,
      responsible: patch.responsible ?? existing.responsible,
      dueDate: (patch.dueDate ?? existing.dueDate) || null,
    })
  }

  return {
    loading,
    inspection: inspection ?? null,
    template: template ?? null,
    answers,
    answerByItem,
    progress,
    overall,
    answer,
    updateFinding,
  }
}
