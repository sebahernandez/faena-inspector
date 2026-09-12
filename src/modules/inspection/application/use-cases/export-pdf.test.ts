/**
 * The exporter is faked here: this test is about assembling the right document
 * from local data, not about PDF bytes. The layout is verified in the browser.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { CAMION_MULTIUSO_V1 } from '@/modules/template/infrastructure/template-seed'
import type { Answer, Inspection } from '../../domain/inspection'
import type {
  DocumentSignatures,
  InspectionRepository,
  PdfExporter,
  TemplateReader,
} from '../ports'
import type { InspectionDocument } from '../inspection-document'
import { exportInspectionPdf, TemplateNotFoundError } from './export-pdf'
import { InspectionNotFoundError } from './answer-item'

const inspection: Inspection = {
  id: 'insp-1',
  templateId: CAMION_MULTIUSO_V1.id,
  templateVersion: 1,
  vehicleType: 'Camión multiuso',
  plate: 'KRDM12',
  brand: null,
  model: null,
  year: null,
  driverName: 'J. Pérez',
  odometerKm: 184320,
  inspectedAt: '2026-03-01T12:00:00.000Z',
  generalObservations: null,
  declaredByName: 'J. Pérez',
  declaredByRole: 'Operador',
  declaredAt: '2026-03-01T13:00:00.000Z',
  approvedByName: null,
  approvedAt: null,
  status: 'submitted',
  syncState: 'queued',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T13:00:00.000Z',
}

const signature = new Blob(['png'], { type: 'image/png' })

let rendered: { document: InspectionDocument; signatures: DocumentSignatures } | null = null
let repository: InspectionRepository
let templates: TemplateReader
let pdf: PdfExporter

const answers: Answer[] = []

beforeEach(() => {
  rendered = null
  answers.length = 0

  repository = {
    async create() {},
    async find(id) {
      return id === inspection.id ? inspection : null
    },
    async update() {},
    async putAnswer() {},
    async listAnswers() {
      return answers
    },
    async submit() {},
    async discard() {},
    async findSignature() {
      return signature
    },
  }

  templates = { find: async (id) => (id === CAMION_MULTIUSO_V1.id ? CAMION_MULTIUSO_V1 : null) }

  pdf = {
    async render(document, signatures) {
      rendered = { document, signatures }
      return new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    },
  }
})

describe('exportInspectionPdf', () => {
  it('returns a PDF blob and a meaningful file name', async () => {
    const result = await exportInspectionPdf('insp-1', { repository, templates, pdf })

    expect(result.blob.type).toBe('application/pdf')
    expect(result.fileName).toBe('checklist-KRDM12-2026-03-01.pdf')
  })

  it('prints all 51 items even when nothing was answered', async () => {
    await exportInspectionPdf('insp-1', { repository, templates, pdf })

    expect(rendered!.document.sections.flatMap((s) => s.rows)).toHaveLength(51)
  })

  it('passes the declaring signature through to the renderer', async () => {
    await exportInspectionPdf('insp-1', { repository, templates, pdf })

    expect(rendered!.signatures.declared).toBe(signature)
    expect(rendered!.signatures.approved).toBeNull()
  })

  it('carries the signatory block', async () => {
    await exportInspectionPdf('insp-1', { repository, templates, pdf })

    expect(rendered!.document.declaredBy).toEqual({
      name: 'J. Pérez',
      role: 'Operador',
      date: '2026-03-01T13:00:00.000Z',
    })
  })

  it('fails clearly when the inspection is gone', async () => {
    await expect(
      exportInspectionPdf('nope', { repository, templates, pdf }),
    ).rejects.toBeInstanceOf(InspectionNotFoundError)
  })

  it('fails clearly when the frozen template is missing', async () => {
    const orphan: TemplateReader = { find: async () => null }
    await expect(
      exportInspectionPdf('insp-1', { repository, templates: orphan, pdf }),
    ).rejects.toBeInstanceOf(TemplateNotFoundError)
  })
})
