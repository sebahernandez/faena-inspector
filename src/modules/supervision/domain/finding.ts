/**
 * Findings across the whole fleet.
 *
 * A finding is a NO inside a signed inspection. Closing one never touches that
 * inspection — the document is immutable — so a closure is a separate fact
 * that points at it.
 */
import type { Session } from '@/modules/auth/domain/session'

export interface FleetFinding {
  inspectionId: string
  itemId: string
  plate: string
  inspectedAt: string
  itemCode: string
  itemLabel: string
  sectionTitle: string
  observation: string | null
  responsible: string | null
  dueDate: string | null
  closed: boolean
  closedAt: string | null
  closedByName: string | null
  closureNote: string | null
  overdue: boolean
}

export type FindingUrgency = 'overdue' | 'due-soon' | 'scheduled' | 'undated' | 'closed'

/** Anything due within this window needs attention now, not next week. */
export const DUE_SOON_DAYS = 7

export function urgencyOf(finding: FleetFinding, today: Date = new Date()): FindingUrgency {
  if (finding.closed) return 'closed'
  if (!finding.dueDate) return 'undated'

  const due = new Date(`${finding.dueDate}T00:00:00`)
  const days = Math.floor((due.getTime() - startOfDay(today).getTime()) / 86_400_000)

  if (days < 0) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'due-soon'
  return 'scheduled'
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

const ORDER: Record<FindingUrgency, number> = {
  overdue: 0,
  'due-soon': 1,
  /**
   * Undated sits above scheduled on purpose. A finding nobody put a date on is
   * not low priority — it is unassigned work that will otherwise never surface,
   * and sorting it to the bottom is how it gets forgotten for a year.
   */
  undated: 2,
  scheduled: 3,
  closed: 4,
}

export function byUrgency(a: FleetFinding, b: FleetFinding, today: Date = new Date()): number {
  const diff = ORDER[urgencyOf(a, today)] - ORDER[urgencyOf(b, today)]
  if (diff !== 0) return diff

  // Within the same bucket: the oldest deadline first, undated by inspection date.
  if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
  return a.inspectedAt.localeCompare(b.inspectedAt)
}

export const sortFindings = (findings: readonly FleetFinding[], today?: Date): FleetFinding[] =>
  [...findings].sort((a, b) => byUrgency(a, b, today))

/** Unassigned work is its own bucket, not a blank name. */
export const UNASSIGNED = 'Sin responsable'

export interface ResponsibleGroup {
  responsible: string
  findings: FleetFinding[]
  openCount: number
  overdueCount: number
}

export function groupByResponsible(
  findings: readonly FleetFinding[],
  today?: Date,
): ResponsibleGroup[] {
  const groups = new Map<string, FleetFinding[]>()

  for (const finding of findings) {
    const key = finding.responsible?.trim() || UNASSIGNED
    groups.set(key, [...(groups.get(key) ?? []), finding])
  }

  return [...groups.entries()]
    .map(([responsible, items]) => ({
      responsible,
      findings: sortFindings(items, today),
      openCount: items.filter((f) => !f.closed).length,
      overdueCount: items.filter((f) => urgencyOf(f, today) === 'overdue').length,
    }))
    // Whoever is most behind goes first; unassigned work never sinks.
    .sort((a, b) => {
      if (a.responsible === UNASSIGNED) return -1
      if (b.responsible === UNASSIGNED) return 1
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount
      return b.openCount - a.openCount
    })
}

export interface FindingTally {
  total: number
  open: number
  overdue: number
  closed: number
}

export const tallyFindings = (findings: readonly FleetFinding[], today?: Date): FindingTally => ({
  total: findings.length,
  open: findings.filter((f) => !f.closed).length,
  overdue: findings.filter((f) => urgencyOf(f, today) === 'overdue').length,
  closed: findings.filter((f) => f.closed).length,
})

export type ClosureBlock = 'not-signed-in' | 'not-a-supervisor' | 'already-closed' | null

export function closureBlock(session: Session | null, finding: FleetFinding): ClosureBlock {
  if (!session) return 'not-signed-in'
  if (session.role !== 'supervisor' && session.role !== 'admin') return 'not-a-supervisor'
  if (finding.closed) return 'already-closed'
  return null
}
