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
import {
  attachEvidencePhoto,
  removeEvidencePhoto,
} from '@/modules/inspection/application/use-cases/attach-evidence'
import { createDexiePhotoRepository } from '@/modules/inspection/infrastructure/dexie-photo.repository'
import { createBrowserImageCompressor } from '@/modules/inspection/infrastructure/browser-image-compressor'
import { submitInspection } from '@/modules/inspection/application/use-cases/submit-inspection'
import { exportInspectionPdf } from '@/modules/inspection/application/use-cases/export-pdf'
import { createReactPdfExporter } from '@/modules/inspection/infrastructure/pdf/react-pdf-exporter'
import type { DeclaredBy, TemplateReader } from '@/modules/inspection/application/ports'
import { createSupabaseAuthGateway } from '@/modules/auth/infrastructure/supabase-auth.gateway'
import { createDexieOutboxRepository } from '@/modules/sync/infrastructure/dexie-outbox.repository'
import { createDexieSyncSource } from '@/modules/sync/infrastructure/dexie-sync-source'
import { createSupabaseRemoteGateway } from '@/modules/sync/infrastructure/supabase-remote.gateway'
import { createSyncScheduler } from '@/modules/sync/application/scheduler'
import { createSupabaseSupervisionGateway } from '@/modules/supervision/infrastructure/supabase-supervision.gateway'
import { db } from '@/shared/db/db'
import { newId } from '@/shared/lib/id'

export const clock: Clock = { now: () => new Date() }
export const ids: IdGenerator = { next: newId }
export const inspections = createDexieInspectionRepository(db)
export const pdf = createReactPdfExporter()
export const photos = createDexiePhotoRepository(db)
const compressor = createBrowserImageCompressor()

/**
 * Sync is optional. With no Supabase project configured the gateway reports
 * `isConfigured() === false` and the inspector side keeps working entirely
 * offline — that is a supported way to run this app, not a broken state.
 */
export const auth = createSupabaseAuthGateway()

export const outbox = createDexieOutboxRepository(db)

/** The online half. Unlike everything above, these calls need a network. */
export const supervision = createSupabaseSupervisionGateway()

/**
 * The only component that talks to the network. Everything else reads and
 * writes the local database and never waits for a server.
 */
export const sync = createSyncScheduler({
  outbox,
  remote: createSupabaseRemoteGateway(db),
  source: createDexieSyncSource(db),
  clock,
  // A hint, not proof: onLine is true on wifi with no internet. A failed
  // attempt is what actually tells us, and the queue handles that.
  isOnline: () => navigator.onLine,
})

const templates: TemplateReader = {
  find: async (id) => (await getTemplate(id, db)) ?? null,
}

/** Read-only live queries the UI subscribes to through useLiveQuery. */
export const queries = {
  draftCount: () => db.inspections.where('status').equals('draft').count(),
  drafts: () => listDrafts(db),
  submitted: () => db.inspections.where('status').anyOf('submitted', 'approved').reverse().sortBy('inspectedAt'),
  pendingUpload: () => listPendingUpload(db),
  outboxPending: () => outbox.countPending(),
  outboxParked: () => outbox.countParked(),
  inspection: (id: string) => findInspection(id, db),
  answers: (id: string) => listAnswersOf(id, db),
  findings: (id: string) => listFindings(id, db),
  activeTemplate: () => getActiveTemplate(db),
  photosOf: (inspectionId: string, itemId: string) => photos.listFor(inspectionId, itemId),
  photosOfInspection: (inspectionId: string) => photos.listForInspection(inspectionId),
  photoImage: (photoId: string) => photos.imageOf(photoId),
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
  attachEvidence: (inspectionId: string, itemId: string, file: File | Blob) =>
    attachEvidencePhoto(
      { inspectionId, itemId, file },
      { inspections, photos, compressor, clock, ids },
    ),
  removeEvidence: (photoId: string, inspectionId: string) =>
    removeEvidencePhoto(photoId, inspectionId, { inspections, photos }),
  submitInspection: (inspectionId: string, signature: Blob, declaredBy: DeclaredBy, totalItems: number) =>
    submitInspection(
      { inspectionId, signature, declaredBy, totalItems },
      { repository: inspections, clock },
    ),
  exportPdf: (id: string) =>
    exportInspectionPdf(id, { repository: inspections, templates, photos, pdf }),
}

export const bootstrap = async (): Promise<void> => {
  await ensureSeeded(db)
  sync.start()
}
