import { describe, expect, it } from 'vitest'
import { toReviewAnswer, toSummary, type AnswerRow, type SummaryRow } from './row-mapping'

const row = (overrides: Partial<SummaryRow> = {}): SummaryRow => ({
  id: 'i-1',
  plate: 'KRDM12',
  vehicle_type: 'Camión multiuso',
  driver_name: 'J. Pérez',
  odometer_km: 184320,
  inspected_at: '2026-03-01T12:00:00Z',
  declared_by_name: 'Juan Pérez',
  declared_by_role: 'Operador',
  declared_at: '2026-03-01T13:00:00Z',
  approved_at: null,
  approved_by_name: null,
  status: 'submitted',
  yes_count: '46',
  no_count: '3',
  na_count: '2',
  answered_count: '51',
  photo_count: '1',
  ...overrides,
})

describe('toSummary', () => {
  it('turns PostgREST bigint strings into real numbers', () => {
    const s = toSummary(row())

    expect(s.yesCount).toBe(46)
    expect(s.noCount).toBe(3)
    expect(s.naCount).toBe(2)
    expect(typeof s.yesCount).toBe('number')
  })

  it('so arithmetic adds instead of concatenating', () => {
    const s = toSummary(row())
    // Left as strings this would be "4632" — and that number would be printed.
    expect(s.yesCount + s.noCount + s.naCount).toBe(51)
    expect(s.answeredCount).toBe(51)
  })

  it('accepts real numbers too', () => {
    const s = toSummary(row({ yes_count: 46, no_count: 3 }))
    expect(s.yesCount).toBe(46)
    expect(s.noCount).toBe(3)
  })

  it('treats a missing count as zero rather than NaN', () => {
    const s = toSummary(row({ photo_count: null as unknown as string }))
    expect(s.photoCount).toBe(0)
  })

  it('keeps the approval fields', () => {
    const s = toSummary(
      row({ status: 'approved', approved_at: '2026-03-02T09:00:00Z', approved_by_name: 'Ana Soto' }),
    )
    expect(s.status).toBe('approved')
    expect(s.approvedByName).toBe('Ana Soto')
  })
})

describe('toReviewAnswer', () => {
  it('carries the finding columns through', () => {
    const a: AnswerRow = {
      item_id: 'it-1',
      section_code: '1',
      section_title: 'Inspección exterior del camión',
      item_code: '1.1',
      item_label: 'Neumáticos del. y tras. en buen estado',
      value: 'NO',
      observation: 'Banda lisa',
      responsible: 'M. Rojas',
      due_date: '2026-04-15',
    }

    expect(toReviewAnswer(a)).toEqual({
      itemId: 'it-1',
      sectionCode: '1',
      sectionTitle: 'Inspección exterior del camión',
      itemCode: '1.1',
      itemLabel: 'Neumáticos del. y tras. en buen estado',
      value: 'NO',
      observation: 'Banda lisa',
      responsible: 'M. Rojas',
      dueDate: '2026-04-15',
    })
  })
})
