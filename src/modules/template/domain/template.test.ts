import { describe, expect, it } from 'vitest'
import { countItems, findItem, templateSchema } from './template'
import { CAMION_MULTIUSO_V1 } from '../infrastructure/template-seed'

describe('CAMION_MULTIUSO_V1 seed', () => {
  it('matches the template schema', () => {
    expect(() => templateSchema.parse(CAMION_MULTIUSO_V1)).not.toThrow()
  })

  it('has the 51 items of the source document', () => {
    expect(countItems(CAMION_MULTIUSO_V1)).toBe(51)
  })

  it('has the expected item count per section', () => {
    expect(CAMION_MULTIUSO_V1.sections.map((s) => s.items.length)).toEqual([12, 8, 12, 13, 6])
  })

  it('numbers every item contiguously — the source skipped 3.5', () => {
    for (const section of CAMION_MULTIUSO_V1.sections) {
      const codes = section.items.map((i) => i.code)
      const expected = section.items.map((_, i) => `${section.code}.${i + 1}`)
      expect(codes, `section ${section.code} must be contiguous`).toEqual(expected)
    }
  })

  it('carries no duplicate item ids', () => {
    const ids = CAMION_MULTIUSO_V1.sections.flatMap((s) => s.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('does not reintroduce the source typos', () => {
    const labels = CAMION_MULTIUSO_V1.sections.flatMap((s) => s.items.map((i) => i.label)).join(' ')
    expect(labels).not.toMatch(/Soladura|Vávula|buene/)
    expect(labels).toContain('Soldadura y uniones sin grietas visibles')
    expect(labels).toContain('Válvulas sin fugas')
  })

  it('finds an item by id', () => {
    expect(findItem(CAMION_MULTIUSO_V1, 'item-5-6')?.label).toBe('Alarma de retroceso operativa')
    expect(findItem(CAMION_MULTIUSO_V1, 'nope')).toBeUndefined()
  })
})
