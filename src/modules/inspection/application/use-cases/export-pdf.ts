import { buildInspectionDocument, documentFileName } from '../inspection-document'
import type {
  EvidenceImage,
  InspectionRepository,
  PdfExporter,
  PhotoRepository,
  TemplateReader,
} from '../ports'
import { findItem } from '@/modules/template/domain/template'
import { InspectionNotFoundError } from './answer-item'

export interface ExportPdfDeps {
  repository: InspectionRepository
  templates: TemplateReader
  photos: PhotoRepository
  pdf: PdfExporter
}

export class TemplateNotFoundError extends Error {
  constructor(id: string) {
    super(`Template ${id} not found`)
    this.name = 'TemplateNotFoundError'
  }
}

/**
 * Produces the PDF entirely on the device.
 *
 * This is the mitigation that makes the whole design safe: the moment the
 * inspector signs, the document leaves the browser. If the browser later evicts
 * local storage — which Safari does — the file is already in the gallery, the
 * email, or the supervisor's chat.
 */
export async function exportInspectionPdf(
  inspectionId: string,
  deps: ExportPdfDeps,
): Promise<{ blob: Blob; fileName: string }> {
  const inspection = await deps.repository.find(inspectionId)
  if (!inspection) throw new InspectionNotFoundError(inspectionId)

  const template = await deps.templates.find(inspection.templateId)
  if (!template) throw new TemplateNotFoundError(inspection.templateId)

  const [answers, declared] = await Promise.all([
    deps.repository.listAnswers(inspectionId),
    deps.repository.findSignature(inspectionId),
  ])

  // Evidence that never reaches the document is half-useless: the supervisor
  // reads the PDF, not the database.
  const evidence: EvidenceImage[] = []
  for (const photo of await deps.photos.listForInspection(inspectionId)) {
    const image = await deps.photos.imageOf(photo.id)
    if (!image) continue // already uploaded and released
    const item = findItem(template, photo.itemId)
    evidence.push({
      itemCode: item?.code ?? '—',
      itemLabel: item?.label ?? '',
      image,
    })
  }

  const document = buildInspectionDocument(inspection, template, answers)
  const blob = await deps.pdf.render(document, { declared, approved: null, evidence })

  return { blob, fileName: documentFileName(document) }
}
