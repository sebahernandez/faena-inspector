import { describe, expect, it } from 'vitest'
import { countFindings, isComplete, isEditable, isFinding, tally, type Answer, type Inspection } from './inspection'

const answer = (value: Answer['value'], itemId = 'item-1-1'): Answer => ({
  inspectionId: 'insp-1',
  itemId,
  value,
  observation: null,
  responsible: null,
  dueDate: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const inspection = (status: Inspection['status']): Inspection => ({
  id: 'insp-1',
  templateId: 'tpl',
  templateVersion: 1,
  vehicleType: null,
  plate: 'ABCD12',
  brand: null,
  model: null,
  year: null,
  driverName: null,
  odometerKm: null,
  inspectedAt: '2026-01-01T00:00:00.000Z',
  generalObservations: null,
  declaredByName: null,
  declaredByRole: null,
  declaredAt: null,
  approvedByName: null,
  approvedAt: null,
  status,
  syncState: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

describe('editability', () => {
  it('allows editing a draft', () => {
    expect(isEditable(inspection('draft'))).toBe(true)
  })

  it('freezes a submitted inspection — it is a legal document', () => {
    expect(isEditable(inspection('submitted'))).toBe(false)
    expect(isEditable(inspection('approved'))).toBe(false)
  })
})

describe('findings', () => {
  it('treats a NO as a finding and nothing else', () => {
    expect(isFinding(answer('NO'))).toBe(true)
    expect(isFinding(answer('YES'))).toBe(false)
    expect(isFinding(answer('NA'))).toBe(false)
  })

  it('counts findings across answers', () => {
    expect(countFindings([answer('NO', 'a'), answer('YES', 'b'), answer('NO', 'c')])).toBe(2)
  })
})

describe('tally', () => {
  it('splits answers by value', () => {
    const answers = [answer('YES', 'a'), answer('NO', 'b'), answer('NA', 'c'), answer('YES', 'd')]
    expect(tally(answers)).toEqual({ yes: 2, no: 1, na: 1, answered: 4 })
  })
})

describe('completeness', () => {
  it('is complete only when every item has an answer', () => {
    const answers = [answer('YES', 'a'), answer('NO', 'b')]
    expect(isComplete(answers, 2)).toBe(true)
    expect(isComplete(answers, 51)).toBe(false)
  })
})
