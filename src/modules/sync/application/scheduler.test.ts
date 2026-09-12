import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSyncScheduler } from './scheduler'
import type { OutboxRepository, RemoteGateway, SyncSourceRepository } from './ports'

const clock = { now: () => new Date('2026-03-01T12:00:00.000Z') }

let drains: number
let resolveDrain: (() => void) | null
let outbox: OutboxRepository
let remote: RemoteGateway
let source: SyncSourceRepository

beforeEach(() => {
  vi.useFakeTimers()
  drains = 0
  resolveDrain = null

  outbox = {
    due: async () => {
      drains++
      if (resolveDrain) await new Promise<void>((r) => (resolveDrain = r as never, r()))
      return []
    },
    remove: async () => {},
    reschedule: async () => {},
    park: async () => {},
    countPending: async () => 0,
    countParked: async () => 0,
  }
  remote = {
    canSync: async () => true,
    uploadSignature: async () => null,
    submitInspection: async () => {},
    uploadPhoto: async () => 'evidence/x.jpg',
  }
  source = {
    loadForUpload: async () => null,
    markSynced: async () => {},
    loadPhotoForUpload: async () => null,
    markPhotoSynced: async () => {},
  }
})

afterEach(() => {
  vi.useRealTimers()
})

const make = (isOnline = true) =>
  createSyncScheduler({ outbox, remote, source, clock, isOnline: () => isOnline, intervalMs: 60_000 })

describe('triggers', () => {
  it('drains as soon as it starts — pending work should not wait for a tick', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(drains).toBe(1)
    s.stop()
  })

  it('drains when the network comes back', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)

    expect(drains).toBe(2)
    s.stop()
  })

  it('drains when the app returns to the foreground — iOS has no background sync', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)

    expect(drains).toBe(2)
    s.stop()
  })

  it('keeps ticking while the app stays open', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(60_000)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(drains).toBe(3)
    s.stop()
  })

  it('stops listening once stopped', async () => {
    const s = make()
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    s.stop()

    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(120_000)

    expect(drains).toBe(1)
  })
})

describe('offline', () => {
  it('does not even try when the browser says there is no network', async () => {
    const s = make(false)
    s.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(drains).toBe(0)
    s.stop()
  })
})

describe('overlap', () => {
  it('refuses to run twice at once', async () => {
    let release: () => void = () => {}
    outbox.due = async () => {
      drains++
      await new Promise<void>((r) => (release = r))
      return []
    }

    const s = make()
    const first = s.syncNow()
    await vi.advanceTimersByTimeAsync(0)

    expect(await s.syncNow()).toBe('busy')
    expect(drains).toBe(1)

    release()
    await first
    s.stop()
  })

  it('can run again once the previous drain finished', async () => {
    const s = make()
    await s.syncNow()
    expect(await s.syncNow()).not.toBe('busy')
    expect(drains).toBe(2)
    s.stop()
  })
})

describe('subscribers', () => {
  it('reports each completed drain', async () => {
    const seen: unknown[] = []
    const s = make()
    const off = s.subscribe((r) => seen.push(r))

    await s.syncNow()
    expect(seen).toHaveLength(1)

    off()
    await s.syncNow()
    expect(seen).toHaveLength(1)
    s.stop()
  })
})
