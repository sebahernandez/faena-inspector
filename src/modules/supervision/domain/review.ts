/**
 * What a supervisor sees and may do.
 *
 * The approval rules live here, away from the screen, because "who may approve
 * what" is the whole point of the role — and it is also enforced again in
 * Postgres. Two layers on purpose: this one gives a good error message, that
 * one makes it true.
 */
import { z } from 'zod'
import type { Session } from '@/modules/auth/domain/session'

export const reviewStatusSchema = z.enum(['submitted', 'approved'])
export type ReviewStatus = z.infer<typeof reviewStatusSchema>

export interface InspectionSummary {
  id: string
  plate: string
  vehicleType: string | null
  driverName: string | null
  odometerKm: number | null
  inspectedAt: string
  declaredByName: string
  declaredByRole: string | null
  declaredAt: string
  approvedAt: string | null
  approvedByName: string | null
  status: ReviewStatus
  yesCount: number
  noCount: number
  naCount: number
  answeredCount: number
  photoCount: number
}

export interface ReviewAnswer {
  itemId: string
  sectionCode: string
  sectionTitle: string
  itemCode: string
  itemLabel: string
  value: 'YES' | 'NO' | 'NA'
  observation: string | null
  responsible: string | null
  dueDate: string | null
}

export type ApprovalBlock =
  | 'not-signed-in'
  | 'not-a-supervisor'
  | 'already-approved'
  | 'own-inspection'
  | null

/**
 * Why this inspection cannot be approved right now, or null if it can.
 *
 * `own-inspection` matters: an inspector promoted to supervisor must not sign
 * off their own work. An approval that the same person declared is not a
 * second pair of eyes — it is a rubber stamp, and the whole reason the form
 * has two signature blocks is that somebody else checks.
 */
export function approvalBlock(
  session: Session | null,
  summary: Pick<InspectionSummary, 'status' | 'declaredByName'>,
  declaredByUserId?: string | null,
): ApprovalBlock {
  if (!session) return 'not-signed-in'
  if (session.role !== 'supervisor' && session.role !== 'admin') return 'not-a-supervisor'
  if (summary.status === 'approved') return 'already-approved'
  if (declaredByUserId && declaredByUserId === session.userId) return 'own-inspection'
  return null
}

export const canApproveNow = (
  session: Session | null,
  summary: Pick<InspectionSummary, 'status' | 'declaredByName'>,
  declaredByUserId?: string | null,
): boolean => approvalBlock(session, summary, declaredByUserId) === null

export const isPending = (s: InspectionSummary): boolean => s.status === 'submitted'
export const findingsOf = (answers: readonly ReviewAnswer[]): ReviewAnswer[] =>
  answers.filter((a) => a.value === 'NO')
