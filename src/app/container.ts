/**
 * Composition root — the only module that knows which implementation backs
 * which port. Everything else depends on interfaces.
 *
 * The UI imports `queries` and `actions` from here and never reaches into
 * infrastructure. There is a test that keeps it that way.
 */
import {
  createDexieInspectionRepository,
  findInspection,
  listAnswersOf,
  listDrafts,
  listFindings,
  listPendingUpload,
} from '@/modules/inspection/infrastructure/dexie-inspection.repository'
import {
  ensureSeeded,
  getActiveTemplate,
  getTemplate,
} from '@/modules/template/infrastructure/dexie-template.repository'
import type { Clock, IdGenerator } from '@/modules/inspection/application/ports'
import { startInspection, type StartInspectionInput } from '@/modules/inspection/application/use-cases/start-inspection'
import { answerItem, type AnswerItemInput } from '@/modules/inspection/application/use-cases/answer-item'
import { updateHeader, type HeaderPatch } from '@/modules/inspection/application/use-cases/update-header'
import { discardDraft } from '@/modules/inspection/application/use-cases/discard-draft'
import { db } from '@/shared/db/db'
import { newId } from '@/shared/lib/id'

export const clock: Clock = { now: () => new Date() }
export const ids: IdGenerator = { next: newId }
export const inspections = createDexieInspectionRepository(db)

/** Read-only live queries the UI subscribes to through useLiveQuery. */
export const queries = {
  draftCount: () => db.inspections.where('status').equals('draft').count(),
  drafts: () => listDrafts(db),
  pendingUpload: () => listPendingUpload(db),
  inspection: (id: string) => findInspection(id, db),
  answers: (id: string) => listAnswersOf(id, db),
  findings: (id: string) => listFindings(id, db),
  activeTemplate: () => getActiveTemplate(db),
  template: (id: string) => getTemplate(id, db),
}

/** Use cases with their dependencies already wired. */
export const actions = {
  startInspection: (input: StartInspectionInput) =>
    startInspection(input, { repository: inspections, clock, ids }),
  answerItem: (input: AnswerItemInput) => answerItem(input, { repository: inspections, clock }),
  updateHeader: (id: string, patch: HeaderPatch) =>
    updateHeader(id, patch, { repository: inspections, clock }),
  discardDraft: (id: string) => discardDraft(id, { repository: inspections }),
}

export const bootstrap = async (): Promise<void> => {
  await ensureSeeded(db)
}
