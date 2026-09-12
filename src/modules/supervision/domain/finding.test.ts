import { describe, expect, it } from 'vitest'
import {
  byUrgency,
  closureBlock,
  groupByResponsible,
  sortFindings,
  tallyFindings,
  UNASSIGNED,
  urgencyOf,
  type FleetFinding,
} from './finding'
import type { Session } from '@/modules/auth/domain/session'

const TODAY = new Date('2026-09-12T10:00:00')

const finding = (over: Partial<FleetFinding> = {}): FleetFinding => ({
  inspectionId: 'i-1',
  itemId: 'it-1',
  plate: 'KRDM12',
  inspectedAt: '2026-09-01T12:00:00Z',
  itemCode: '1.1',
  itemLabel: 'Neumáticos del. y tras. en buen estado',
  sectionTitle: 'Inspección exterior del camión',
  observation: 'Banda lisa',
  responsible: 'M. Rojas',
  dueDate: '2026-10-15',
  closed: false,
  closedAt: null,
  closedByName: null,
  closureNote: null,
  overdue: false,
  ...over,
})

describe('urgencyOf', () => {
  it('flags a past deadline', () => {
    expect(urgencyOf(finding({ dueDate: '2026-09-11' }), TODAY)).toBe('overdue')
  })

  it('does not flag today as late', () => {
    expect(urgencyOf(finding({ dueDate: '2026-09-12' }), TODAY)).toBe('due-soon')
  })

  it('warns a week ahead', () => {
    expect(urgencyOf(finding({ dueDate: '2026-09-19' }), TODAY)).toBe('due-soon')
    expect(urgencyOf(finding({ dueDate: '2026-09-20' }), TODAY)).toBe('scheduled')
  })

  it('separates a finding nobody dated', () => {
    expect(urgencyOf(finding({ dueDate: null }), TODAY)).toBe('undated')
  })

  it('stops being urgent once closed, however late it was', () => {
    expect(urgencyOf(finding({ dueDate: '2020-01-01', closed: true }), TODAY)).toBe('closed')
  })
})

describe('sorting', () => {
  it('puts undated work above scheduled work so it does not get forgotten', () => {
    const order = sortFindings(
      [
        finding({ itemCode: 'scheduled', dueDate: '2026-12-01' }),
        finding({ itemCode: 'undated', dueDate: null }),
      ],
      TODAY,
    ).map((f) => f.itemCode)

    expect(order).toEqual(['undated', 'scheduled'])
  })

  it('orders overdue, then due soon, then undated, then scheduled, then closed', () => {
    const order = sortFindings(
      [
        finding({ itemCode: 'closed', closed: true }),
        finding({ itemCode: 'scheduled', dueDate: '2026-12-01' }),
        finding({ itemCode: 'undated', dueDate: null }),
        finding({ itemCode: 'overdue', dueDate: '2026-08-01' }),
        finding({ itemCode: 'soon', dueDate: '2026-09-14' }),
      ],
      TODAY,
    ).map((f) => f.itemCode)

    expect(order).toEqual(['overdue', 'soon', 'undated', 'scheduled', 'closed'])
  })

  it('within the same bucket, the oldest deadline first', () => {
    const order = sortFindings(
      [
        finding({ itemCode: 'b', dueDate: '2026-08-20' }),
        finding({ itemCode: 'a', dueDate: '2026-08-01' }),
      ],
      TODAY,
    ).map((f) => f.itemCode)

    expect(order).toEqual(['a', 'b'])
  })

  it('does not mutate the input', () => {
    const input = [finding({ itemCode: 'z', dueDate: '2026-12-01' }), finding({ itemCode: 'a', dueDate: '2026-08-01' })]
    sortFindings(input, TODAY)
    expect(input[0]?.itemCode).toBe('z')
  })

  it('is a stable comparator', () => {
    expect(byUrgency(finding({ dueDate: '2026-08-01' }), finding({ dueDate: '2026-08-01' }), TODAY)).toBe(0)
  })
})

describe('groupByResponsible', () => {
  it('buckets unnamed work instead of showing a blank name', () => {
    const groups = groupByResponsible(
      [finding({ responsible: null }), finding({ responsible: '   ' })],
      TODAY,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]?.responsible).toBe(UNASSIGNED)
    expect(groups[0]?.findings).toHaveLength(2)
  })

  it('puts unassigned work first — nobody is chasing it', () => {
    const groups = groupByResponsible(
      [
        finding({ responsible: 'M. Rojas', dueDate: '2026-08-01' }),
        finding({ responsible: 'M. Rojas', dueDate: '2026-08-02' }),
        finding({ responsible: null }),
      ],
      TODAY,
    )
    expect(groups[0]?.responsible).toBe(UNASSIGNED)
  })

  it('then orders by who is most behind', () => {
    const groups = groupByResponsible(
      [
        finding({ responsible: 'Al día', dueDate: '2026-12-01' }),
        finding({ responsible: 'Atrasado', dueDate: '2026-08-01' }),
        finding({ responsible: 'Atrasado', dueDate: '2026-08-02' }),
      ],
      TODAY,
    )
    expect(groups.map((g) => g.responsible)).toEqual(['Atrasado', 'Al día'])
    expect(groups[0]?.overdueCount).toBe(2)
  })

  it('counts open and overdue per person', () => {
    const groups = groupByResponsible(
      [
        finding({ responsible: 'M. Rojas', dueDate: '2026-08-01' }),
        finding({ responsible: 'M. Rojas', dueDate: '2026-12-01' }),
        finding({ responsible: 'M. Rojas', closed: true }),
      ],
      TODAY,
    )
    expect(groups[0]).toMatchObject({ openCount: 2, overdueCount: 1 })
  })
})

describe('tallyFindings', () => {
  it('counts the fleet at a glance', () => {
    expect(
      tallyFindings(
        [
          finding({ dueDate: '2026-08-01' }),
          finding({ dueDate: '2026-12-01' }),
          finding({ closed: true }),
        ],
        TODAY,
      ),
    ).toEqual({ total: 3, open: 2, overdue: 1, closed: 1 })
  })
})

describe('closureBlock', () => {
  const session = (role: Session['role']): Session => ({
    userId: 'u-1',
    email: 'a@b.cl',
    orgId: 'org-1',
    fullName: 'Ana Soto',
    jobTitle: null,
    role,
  })

  it('blocks an anonymous visitor', () => {
    expect(closureBlock(null, finding())).toBe('not-signed-in')
  })

  it('blocks an inspector', () => {
    expect(closureBlock(session('inspector'), finding())).toBe('not-a-supervisor')
  })

  it('allows a supervisor', () => {
    expect(closureBlock(session('supervisor'), finding())).toBeNull()
  })

  it('blocks closing something already closed', () => {
    expect(closureBlock(session('supervisor'), finding({ closed: true }))).toBe('already-closed')
  })
})
