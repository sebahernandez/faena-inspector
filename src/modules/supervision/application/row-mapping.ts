/**
 * Server rows into domain objects.
 *
 * A contract, not infrastructure: no client imported, nothing but data in and
 * data out — so it can be tested without a server.
 *
 * The reason this exists as its own module: Postgres `count()` is a bigint, and
 * PostgREST serialises bigint as a STRING to avoid losing precision in JSON.
 * Left alone, `yesCount` would be "46" and `yesCount + noCount` would be "463"
 * instead of 49. A tally that silently concatenates is exactly the kind of bug
 * that reaches a printed document.
 */
import type { InspectionSummary, ReviewAnswer, ReviewStatus } from '../domain/review'

export interface SummaryRow {
  id: string
  plate: string
  vehicle_type: string | null
  driver_name: string | null
  odometer_km: number | null
  inspected_at: string
  declared_by_name: string
  declared_by_role: string | null
  declared_at: string
  approved_at: string | null
  approved_by_name: string | null
  status: ReviewStatus
  yes_count: number | string
  no_count: number | string
  na_count: number | string
  answered_count: number | string
  photo_count: number | string
}

export interface AnswerRow {
  item_id: string
  section_code: string
  section_title: string
  item_code: string
  item_label: string
  value: ReviewAnswer['value']
  observation: string | null
  responsible: string | null
  due_date: string | null
}

const count = (value: number | string | null | undefined): number => {
  const n = typeof value === 'string' ? Number(value) : value
  return Number.isFinite(n) ? (n as number) : 0
}

export const toSummary = (r: SummaryRow): InspectionSummary => ({
  id: r.id,
  plate: r.plate,
  vehicleType: r.vehicle_type,
  driverName: r.driver_name,
  odometerKm: r.odometer_km,
  inspectedAt: r.inspected_at,
  declaredByName: r.declared_by_name,
  declaredByRole: r.declared_by_role,
  declaredAt: r.declared_at,
  approvedAt: r.approved_at,
  approvedByName: r.approved_by_name,
  status: r.status,
  yesCount: count(r.yes_count),
  noCount: count(r.no_count),
  naCount: count(r.na_count),
  answeredCount: count(r.answered_count),
  photoCount: count(r.photo_count),
})

export const toReviewAnswer = (a: AnswerRow): ReviewAnswer => ({
  itemId: a.item_id,
  sectionCode: a.section_code,
  sectionTitle: a.section_title,
  itemCode: a.item_code,
  itemLabel: a.item_label,
  value: a.value,
  observation: a.observation,
  responsible: a.responsible,
  dueDate: a.due_date,
})
