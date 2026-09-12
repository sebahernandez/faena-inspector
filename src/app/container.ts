/**
 * Composition root — the only module that knows which implementation backs
 * which port. Everything else depends on interfaces.
 *
 * Swapping Dexie, or handing a fake to a test, happens here and nowhere else.
 */
import { createDexieInspectionRepository } from '@/modules/inspection/infrastructure/dexie-inspection.repository'
import {
  listDrafts,
  listFindings,
  listPendingUpload,
} from '@/modules/inspection/infrastructure/dexie-inspection.repository'
import {
  ensureSeeded,
  getActiveTemplate,
} from '@/modules/template/infrastructure/dexie-template.repository'
import type { Clock, IdGenerator } from '@/modules/inspection/application/ports'
import { db } from '@/shared/db/db'
import { newId } from '@/shared/lib/id'

export const clock: Clock = { now: () => new Date() }
export const ids: IdGenerator = { next: newId }
export const inspections = createDexieInspectionRepository(db)

/** Read-only live queries the UI subscribes to through useLiveQuery. */
export const queries = {
  draftCount: () => db.inspections.where('status').equals('draft').count(),
  pendingUploadCount: () => listPendingUpload(db).then((rows) => rows.length),
  drafts: () => listDrafts(db),
  findings: (inspectionId: string) => listFindings(inspectionId, db),
  activeTemplate: () => getActiveTemplate(db),
}

export const bootstrap = async (): Promise<void> => {
  await ensureSeeded(db)
}
