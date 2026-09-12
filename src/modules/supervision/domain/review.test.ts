import { describe, expect, it } from 'vitest'
import { approvalBlock, canApproveNow, findingsOf, isPending } from './review'
import type { InspectionSummary, ReviewAnswer } from './review'
import type { Session } from '@/modules/auth/domain/session'

const session = (role: Session['role'], userId = 'sup-1'): Session => ({
  userId,
  email: 'a@b.cl',
  orgId: 'org-1',
  fullName: 'Ana Soto',
  jobTitle: null,
  role,
})

const summary = (status: 'submitted' | 'approved' = 'submitted') =>
  ({ status, declaredByName: 'Juan Pérez' }) as InspectionSummary

describe('approvalBlock', () => {
  it('blocks an anonymous visitor', () => {
    expect(approvalBlock(null, summary())).toBe('not-signed-in')
  })

  it('blocks an inspector', () => {
    expect(approvalBlock(session('inspector'), summary())).toBe('not-a-supervisor')
  })

  it('allows a supervisor', () => {
    expect(approvalBlock(session('supervisor'), summary())).toBeNull()
  })

  it('allows an admin', () => {
    expect(approvalBlock(session('admin'), summary())).toBeNull()
  })

  it('blocks a second approval', () => {
    expect(approvalBlock(session('supervisor'), summary('approved'))).toBe('already-approved')
  })

  it('blocks approving your own inspection — that is a rubber stamp, not a review', () => {
    expect(approvalBlock(session('supervisor', 'u-9'), summary(), 'u-9')).toBe('own-inspection')
  })

  it('allows approving somebody else work', () => {
    expect(approvalBlock(session('supervisor', 'u-9'), summary(), 'u-1')).toBeNull()
  })
})

describe('canApproveNow', () => {
  it('mirrors approvalBlock', () => {
    expect(canApproveNow(session('supervisor'), summary())).toBe(true)
    expect(canApproveNow(session('inspector'), summary())).toBe(false)
  })
})

describe('helpers', () => {
  it('separates pending from approved', () => {
    expect(isPending(summary())).toBe(true)
    expect(isPending(summary('approved'))).toBe(false)
  })

  it('keeps only the NOs as findings', () => {
    const answers = [
      { value: 'NO', itemCode: '1.1' },
      { value: 'YES', itemCode: '1.2' },
      { value: 'NA', itemCode: '1.3' },
    ] as ReviewAnswer[]
    expect(findingsOf(answers).map((a) => a.itemCode)).toEqual(['1.1'])
  })
})
