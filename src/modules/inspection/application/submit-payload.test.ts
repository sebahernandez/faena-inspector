import { describe, expect, it } from 'vitest'
import { toSubmitPayload, UnsignedInspectionError } from './submit-payload'
import { itemUuid, TEMPLATE_UUID } from '@/modules/template/infrastructure/template-seed'
import type { Answer, Inspection } from '../domain/inspection'

const signed: Inspection = {
  id: '01a09396-5cf6-72a4-983a-daaf34f1316a',
  templateId: TEMPLATE_UUID,
  templateVersion: 1,
  vehicleType: 'Camión multiuso',
  plate: 'KRDM12',
  brand: 'Mercedes-Benz',
  model: 'Actros 2644',
  year: 2021,
  driverName: 'J. Pérez',
  odometerKm: 184320,
  inspectedAt: '2026-03-01T12:00:00.000Z',
  generalObservations: 'Equipo operativo.',
  declaredByName: 'Juan Pérez',
  declaredByRole: 'Operador',
  declaredAt: '2026-03-01T13:00:00.000Z',
  approvedByName: null,
  approvedAt: null,
  status: 'submitted',
  syncState: 'queued',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T13:00:00.000Z',
}

const answer: Answer = {
  inspectionId: signed.id,
  itemId: itemUuid(1, 1),
  value: 'NO',
  observation: 'Banda lisa',
  responsible: 'M. Rojas',
  dueDate: '2026-04-15',
  updatedAt: '2026-03-01T12:30:00.000Z',
}

describe('toSubmitPayload', () => {
  it('maps the header the server expects', () => {
    const p = toSubmitPayload(signed, [], 'signatures/a/declared.png')

    expect(p.inspection).toEqual({
      id: signed.id,
      template_id: TEMPLATE_UUID,
      template_version: 1,
      vehicle_type: 'Camión multiuso',
      plate: 'KRDM12',
      brand: 'Mercedes-Benz',
      model: 'Actros 2644',
      year: 2021,
      driver_name: 'J. Pérez',
      odometer_km: 184320,
      inspected_at: '2026-03-01T12:00:00.000Z',
      general_observations: 'Equipo operativo.',
      declared_by_name: 'Juan Pérez',
      declared_by_role: 'Operador',
      declared_signature_path: 'signatures/a/declared.png',
      declared_at: '2026-03-01T13:00:00.000Z',
    })
  })

  it('never sends org, author or status — the server stamps those', () => {
    const p = toSubmitPayload(signed, [], null)
    const keys = Object.keys(p.inspection)

    expect(keys).not.toContain('org_id')
    expect(keys).not.toContain('created_by')
    expect(keys).not.toContain('status')
  })

  it('carries the finding columns', () => {
    const p = toSubmitPayload(signed, [answer], null)

    expect(p.answers).toEqual([
      {
        item_id: itemUuid(1, 1),
        value: 'NO',
        observation: 'Banda lisa',
        responsible: 'M. Rojas',
        due_date: '2026-04-15',
      },
    ])
  })

  it('refuses to upload an unsigned draft', () => {
    const draft = { ...signed, declaredByName: null, declaredAt: null, status: 'draft' as const }
    expect(() => toSubmitPayload(draft, [], null)).toThrow(UnsignedInspectionError)
  })

  it('sends item ids that match the seeded template', () => {
    const p = toSubmitPayload(signed, [answer], null)
    expect(p.answers[0]?.item_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
