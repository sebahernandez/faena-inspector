import { describe, expect, it } from 'vitest'
import { classifyFailure, isExhausted, MAX_ATTEMPTS, nextDelayMs } from './retry'

describe('classifyFailure', () => {
  it('treats a missing session as recoverable by signing in, not as a queue failure', () => {
    expect(classifyFailure({ status: 401 })).toBe('unauthenticated')
    expect(classifyFailure({ message: 'JWT expired' })).toBe('unauthenticated')
  })

  it('treats a lost network as transient', () => {
    expect(classifyFailure({ message: 'Failed to fetch' })).toBe('transient')
    expect(classifyFailure({ message: 'network error' })).toBe('transient')
    expect(classifyFailure({})).toBe('transient')
  })

  it('treats server trouble as transient', () => {
    for (const status of [500, 502, 503, 504, 408, 429]) {
      expect(classifyFailure({ status })).toBe('transient')
    }
  })

  it('treats a refusal of the content itself as permanent', () => {
    expect(classifyFailure({ status: 400 })).toBe('permanent')
    expect(classifyFailure({ status: 422 })).toBe('permanent')
    expect(classifyFailure({ status: 403 })).toBe('permanent')
    expect(classifyFailure({ code: '42501', message: 'only a supervisor can approve' })).toBe('permanent')
  })
})

describe('nextDelayMs', () => {
  it('grows with each attempt', () => {
    const noJitter = () => 1
    const delays = [1, 2, 3, 4, 5].map((n) => nextDelayMs(n, noJitter))
    expect(delays).toEqual([...delays].sort((a, b) => a - b))
    expect(delays[0]).toBeLessThan(delays[4]!)
  })

  it('is capped so a phone never waits forever', () => {
    expect(nextDelayMs(50, () => 1)).toBeLessThanOrEqual(30 * 60_000)
  })

  it('spreads the herd — a crew leaving a dead zone does not hit at once', () => {
    const low = nextDelayMs(4, () => 0)
    const high = nextDelayMs(4, () => 1)
    expect(low).toBeLessThan(high)
    expect(low).toBeGreaterThan(0)
  })

  it('never returns zero', () => {
    for (let n = 0; n < 10; n++) expect(nextDelayMs(n, () => 0)).toBeGreaterThan(0)
  })
})

describe('isExhausted', () => {
  it('parks an entry after the cap so it stops burning battery', () => {
    expect(isExhausted(MAX_ATTEMPTS - 1)).toBe(false)
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true)
  })
})
