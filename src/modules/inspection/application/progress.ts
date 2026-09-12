import type { Answer } from '../domain/inspection'
import type { Template, TemplateSection } from '@/modules/template/domain/template'

export interface SectionProgress {
  section: TemplateSection
  answered: number
  total: number
  findings: number
  complete: boolean
}

/**
 * How far along each section is.
 *
 * The inspector needs to see this at a glance: 51 items is a long way to walk
 * around a truck, and they will be interrupted.
 */
export function sectionProgress(
  template: Template,
  answers: readonly Answer[],
): SectionProgress[] {
  const byItem = new Map(answers.map((a) => [a.itemId, a]))

  return template.sections.map((section) => {
    const answered = section.items.filter((item) => byItem.has(item.id))
    const findings = answered.filter((item) => byItem.get(item.id)?.value === 'NO')

    return {
      section,
      answered: answered.length,
      total: section.items.length,
      findings: findings.length,
      complete: answered.length === section.items.length,
    }
  })
}

export const overallProgress = (progress: readonly SectionProgress[]) => {
  const answered = progress.reduce((sum, p) => sum + p.answered, 0)
  const total = progress.reduce((sum, p) => sum + p.total, 0)
  return { answered, total, percent: total === 0 ? 0 : Math.round((answered / total) * 100) }
}
