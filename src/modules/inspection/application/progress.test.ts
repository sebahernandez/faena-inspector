import { describe, expect, it } from 'vitest'
import { overallProgress, sectionProgress } from './progress'
import { CAMION_MULTIUSO_V1 } from '@/modules/template/infrastructure/template-seed'
import type { Answer, AnswerValue } from '../domain/inspection'

const answer = (itemId: string, value: AnswerValue): Answer => ({
  inspectionId: 'insp-1',
  itemId,
  value,
  observation: null,
  responsible: null,
  dueDate: null,
  updatedAt: '2026-03-01T00:00:00.000Z',
})

describe('sectionProgress', () => {
  it('reports zero across all sections when nothing is answered', () => {
    const progress = sectionProgress(CAMION_MULTIUSO_V1, [])

    expect(progress).toHaveLength(5)
    expect(progress.map((p) => p.answered)).toEqual([0, 0, 0, 0, 0])
    expect(progress.map((p) => p.total)).toEqual([12, 8, 12, 13, 6])
    expect(progress.every((p) => !p.complete)).toBe(true)
  })

  it('marks a section complete only when every one of its items is answered', () => {
    const section5 = CAMION_MULTIUSO_V1.sections[4]!
    const answers = section5.items.map((item) => answer(item.id, 'YES'))

    const progress = sectionProgress(CAMION_MULTIUSO_V1, answers)
    expect(progress[4]?.complete).toBe(true)
    expect(progress[0]?.complete).toBe(false)
  })

  it('counts findings per section', () => {
    const section1 = CAMION_MULTIUSO_V1.sections[0]!
    const answers = [
      answer(section1.items[0]!.id, 'NO'),
      answer(section1.items[1]!.id, 'NO'),
      answer(section1.items[2]!.id, 'YES'),
    ]

    expect(sectionProgress(CAMION_MULTIUSO_V1, answers)[0]?.findings).toBe(2)
  })

  it('ignores answers whose item is not in the template', () => {
    const progress = sectionProgress(CAMION_MULTIUSO_V1, [answer('ghost-item', 'YES')])
    expect(overallProgress(progress).answered).toBe(0)
  })
})

describe('overallProgress', () => {
  it('totals 51 items across the whole template', () => {
    expect(overallProgress(sectionProgress(CAMION_MULTIUSO_V1, [])).total).toBe(51)
  })

  it('reports a percentage', () => {
    const items = CAMION_MULTIUSO_V1.sections.flatMap((s) => s.items)
    const answers = items.slice(0, 26).map((item) => answer(item.id, 'YES'))

    const overall = overallProgress(sectionProgress(CAMION_MULTIUSO_V1, answers))
    expect(overall).toEqual({ answered: 26, total: 51, percent: 51 })
  })
})
