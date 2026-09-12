/**
 * The printable shape of an inspection.
 *
 * A pure translation from (inspection + frozen template + answers) into the
 * rows the PDF draws. Keeping it here — with no renderer, no React, no binary —
 * means the layout of a legal document can be tested without rendering one.
 */
import type { Answer, AnswerValue, Inspection } from '../domain/inspection'
import { tally, type AnswerTally } from '../domain/inspection'
import type { Template } from '@/modules/template/domain/template'

export interface DocumentRow {
  code: string
  label: string
  /** null when the item was left unanswered. */
  value: AnswerValue | null
  observation: string | null
  responsible: string | null
  dueDate: string | null
}

export interface DocumentSection {
  code: string
  title: string
  rows: DocumentRow[]
}

export interface DocumentSignatory {
  name: string
  role: string | null
  date: string | null
}

export interface InspectionDocument {
  title: string
  templateVersion: number
  vehicle: {
    type: string | null
    plate: string
    brand: string | null
    model: string | null
    year: number | null
    driverName: string | null
    odometerKm: number | null
    inspectedAt: string
  }
  sections: DocumentSection[]
  tally: AnswerTally
  findingCount: number
  generalObservations: string | null
  declaredBy: DocumentSignatory | null
  approvedBy: DocumentSignatory | null
}

export function buildInspectionDocument(
  inspection: Inspection,
  template: Template,
  answers: readonly Answer[],
): InspectionDocument {
  const byItem = new Map(answers.map((a) => [a.itemId, a]))

  const sections: DocumentSection[] = template.sections.map((section) => ({
    code: section.code,
    title: section.title,
    rows: section.items.map((item) => {
      const answer = byItem.get(item.id)
      return {
        code: item.code,
        label: item.label,
        value: answer?.value ?? null,
        observation: answer?.observation ?? null,
        responsible: answer?.responsible ?? null,
        dueDate: answer?.dueDate ?? null,
      }
    }),
  }))

  // Only answers belonging to this template count — a stale answer from a
  // previous template version must never appear in the totals.
  const relevant = sections.flatMap((s) => s.rows).filter((r) => r.value !== null)

  return {
    title: template.name,
    templateVersion: inspection.templateVersion,
    vehicle: {
      type: inspection.vehicleType,
      plate: inspection.plate,
      brand: inspection.brand,
      model: inspection.model,
      year: inspection.year,
      driverName: inspection.driverName,
      odometerKm: inspection.odometerKm,
      inspectedAt: inspection.inspectedAt,
    },
    sections,
    tally: tally(
      relevant.map((r) => ({ value: r.value }) as Answer),
    ),
    findingCount: relevant.filter((r) => r.value === 'NO').length,
    generalObservations: inspection.generalObservations,
    declaredBy: inspection.declaredByName
      ? {
          name: inspection.declaredByName,
          role: inspection.declaredByRole,
          date: inspection.declaredAt,
        }
      : null,
    approvedBy: inspection.approvedByName
      ? { name: inspection.approvedByName, role: null, date: inspection.approvedAt }
      : null,
  }
}

/** Stable, sortable, and meaningful when it lands in a WhatsApp thread. */
export function documentFileName(document: InspectionDocument): string {
  const date = document.vehicle.inspectedAt.slice(0, 10)
  const plate = document.vehicle.plate.replace(/[^A-Z0-9]/gi, '')
  return `checklist-${plate}-${date}.pdf`
}
