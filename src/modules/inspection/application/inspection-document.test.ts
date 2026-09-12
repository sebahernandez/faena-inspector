import { describe, expect, it } from 'vitest'
import { buildInspectionDocument, documentFileName } from './inspection-document'
import { CAMION_MULTIUSO_V1 } from '@/modules/template/infrastructure/template-seed'
import type { Answer, AnswerValue, Inspection } from '../domain/inspection'

const inspection = (overrides: Partial<Inspection> = {}): Inspection => ({
  id: 'insp-1',
  templateId: CAMION_MULTIUSO_V1.id,
  templateVersion: 1,
  vehicleType: 'Camión multiuso',
  plate: 'KRDM12',
  brand: 'Mercedes',
  model: 'Actros',
  year: 2021,
  driverName: 'J. Pérez',
  odometerKm: 184320,
  inspectedAt: '2026-03-01T12:00:00.000Z',
  generalObservations: null,
  declaredByName: null,
  declaredByRole: null,
  declaredAt: null,
  approvedByName: null,
  approvedAt: null,
  status: 'draft',
  syncState: 'local',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
  ...overrides,
})

const answer = (itemId: string, value: AnswerValue, extra: Partial<Answer> = {}): Answer => ({
  inspectionId: 'insp-1',
  itemId,
  value,
  observation: null,
  responsible: null,
  dueDate: null,
  updatedAt: '2026-03-01T12:00:00.000Z',
  ...extra,
})

const items = CAMION_MULTIUSO_V1.sections.flatMap((s) => s.items)

describe('buildInspectionDocument', () => {
  it('keeps the five sections and all 51 rows of the source document', () => {
    const doc = buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, [])

    expect(doc.sections).toHaveLength(5)
    expect(doc.sections.map((s) => s.rows.length)).toEqual([12, 8, 12, 13, 6])
    expect(doc.sections.flatMap((s) => s.rows)).toHaveLength(51)
  })

  it('prints every item, answered or not', () => {
    const doc = buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, [
      answer(items[0]!.id, 'YES'),
    ])

    const rows = doc.sections.flatMap((s) => s.rows)
    expect(rows[0]?.value).toBe('YES')
    expect(rows[1]?.value).toBeNull()
    expect(rows).toHaveLength(51)
  })

  it('carries the finding columns from the source document', () => {
    const doc = buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, [
      answer(items[0]!.id, 'NO', {
        observation: 'Neumático liso',
        responsible: 'M. Rojas',
        dueDate: '2026-04-15',
      }),
    ])

    expect(doc.sections[0]?.rows[0]).toMatchObject({
      code: '1.1',
      value: 'NO',
      observation: 'Neumático liso',
      responsible: 'M. Rojas',
      dueDate: '2026-04-15',
    })
  })

  it('totals only answers that belong to this template', () => {
    const doc = buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, [
      answer(items[0]!.id, 'YES'),
      answer(items[1]!.id, 'NO'),
      answer(items[2]!.id, 'NA'),
      answer('ghost-from-another-version', 'YES'),
    ])

    expect(doc.tally).toEqual({ yes: 1, no: 1, na: 1, answered: 3 })
    expect(doc.findingCount).toBe(1)
  })

  it('freezes the template version the inspection was started with', () => {
    const doc = buildInspectionDocument(inspection({ templateVersion: 3 }), CAMION_MULTIUSO_V1, [])
    expect(doc.templateVersion).toBe(3)
  })

  it('omits the declaring signatory until the inspection is signed', () => {
    expect(buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, []).declaredBy).toBeNull()

    const signed = buildInspectionDocument(
      inspection({
        declaredByName: 'J. Pérez',
        declaredByRole: 'Operador',
        declaredAt: '2026-03-01T13:00:00.000Z',
      }),
      CAMION_MULTIUSO_V1,
      [],
    )
    expect(signed.declaredBy).toEqual({
      name: 'J. Pérez',
      role: 'Operador',
      date: '2026-03-01T13:00:00.000Z',
    })
  })

  it('omits the approver until a supervisor approves', () => {
    expect(buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, []).approvedBy).toBeNull()
  })
})

describe('documentFileName', () => {
  it('is meaningful once it lands in somebody else\'s phone', () => {
    const doc = buildInspectionDocument(inspection(), CAMION_MULTIUSO_V1, [])
    expect(documentFileName(doc)).toBe('checklist-KRDM12-2026-03-01.pdf')
  })

  it('strips anything that would break a filename', () => {
    const doc = buildInspectionDocument(inspection({ plate: 'KR-DM 12' }), CAMION_MULTIUSO_V1, [])
    expect(documentFileName(doc)).toBe('checklist-KRDM12-2026-03-01.pdf')
  })
})
