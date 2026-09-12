import { beforeEach, describe, expect, it } from 'vitest'
import { drainOutbox } from './drain-outbox'
import { MAX_ATTEMPTS } from '../domain/retry'
import type { OutboxEntry, OutboxRepository, RemoteGateway, SyncSourceRepository } from './ports'
import type { SubmitPayload } from '@/modules/inspection/application/submit-payload'

const NOW = new Date('2026-03-01T12:00:00.000Z')
const clock = { now: () => NOW }

const payload = (id: string): SubmitPayload => ({
  inspection: {
    id,
    template_id: 't',
    template_version: 1,
    vehicle_type: null,
    plate: 'AB1234',
    brand: null,
    model: null,
    year: null,
    driver_name: null,
    odometer_km: null,
    inspected_at: NOW.toISOString(),
    general_observations: null,
    declared_by_name: 'J. Pérez',
    declared_by_role: null,
    declared_signature_path: null,
    declared_at: NOW.toISOString(),
  },
  answers: [],
})

class FakeOutbox implements OutboxRepository {
  entries: OutboxEntry[] = []
  parked: { seq: number; error: string }[] = []
  rescheduled: { seq: number; at: string; error: string }[] = []

  async due() {
    return [...this.entries]
  }
  async remove(seq: number) {
    this.entries = this.entries.filter((e) => e.seq !== seq)
  }
  async reschedule(seq: number, at: string, error: string) {
    this.rescheduled.push({ seq, at, error })
    const e = this.entries.find((x) => x.seq === seq)
    if (e) e.attempts++
  }
  async park(seq: number, error: string) {
    this.parked.push({ seq, error })
    this.entries = this.entries.filter((e) => e.seq !== seq)
  }
  async countPending() {
    return this.entries.length
  }
  async countParked() {
    return this.parked.length
  }
}

const entry = (seq: number, entityId: string, attempts = 0): OutboxEntry => ({
  seq,
  dedupeKey: `inspection:${entityId}`,
  kind: 'inspection',
  entityId,
  attempts,
  nextAttemptAt: NOW.toISOString(),
  lastError: null,
})

let outbox: FakeOutbox
let submitted: string[]
let synced: string[]
let remote: RemoteGateway
let source: SyncSourceRepository

beforeEach(() => {
  outbox = new FakeOutbox()
  submitted = []
  synced = []
  remote = {
    canSync: async () => true,
    uploadSignature: async () => 'signatures/a/declared.png',
    uploadPhoto: async (p) => `evidence/${p.id}.jpg`,
    submitInspection: async (p) => {
      submitted.push(p.inspection.id)
    },
  }
  source = {
    loadPhotoForUpload: async () => null,
    markPhotoSynced: async () => {},
    loadForUpload: async (id) => payload(id),
    markSynced: async (id) => {
      synced.push(id)
    },
  }
})

const run = (extra: Partial<{ random: () => number }> = {}) =>
  drainOutbox({ outbox, remote, source, clock, random: () => 1, ...extra })

describe('happy path', () => {
  it('uploads each entry and clears it', async () => {
    outbox.entries = [entry(1, 'a'), entry(2, 'b')]

    const r = await run()

    expect(submitted).toEqual(['a', 'b'])
    expect(synced).toEqual(['a', 'b'])
    expect(outbox.entries).toHaveLength(0)
    expect(r.uploaded).toBe(2)
  })

  it('attaches the uploaded signature path to the payload', async () => {
    outbox.entries = [entry(1, 'a')]
    let seen: string | null = 'unset'
    remote.submitInspection = async (p) => {
      seen = p.inspection.declared_signature_path
    }

    await run()
    expect(seen).toBe('signatures/a/declared.png')
  })

  it('marks it synced only after the server accepted it', async () => {
    outbox.entries = [entry(1, 'a')]
    remote.submitInspection = async () => {
      throw Object.assign(new Error('Failed to fetch'), {})
    }

    await run()
    expect(synced).toEqual([])
    expect(outbox.entries).toHaveLength(1)
  })
})

describe('not signed in', () => {
  it('attempts nothing and spends no retry budget', async () => {
    outbox.entries = [entry(1, 'a')]
    remote.canSync = async () => false

    const r = await run()

    expect(submitted).toEqual([])
    expect(outbox.entries[0]?.attempts).toBe(0)
    expect(r.skipped).toBe('signed-out')
  })

  it('stops the whole drain when the session expires mid-run', async () => {
    outbox.entries = [entry(1, 'a'), entry(2, 'b')]
    remote.submitInspection = async () => {
      throw Object.assign(new Error('JWT expired'), { status: 401 })
    }

    const r = await run()

    expect(r.skipped).toBe('signed-out')
    expect(outbox.parked).toEqual([])
    expect(outbox.rescheduled).toEqual([])
    expect(outbox.entries).toHaveLength(2)
  })
})

describe('transient failures', () => {
  it('reschedules with a growing delay instead of hammering', async () => {
    outbox.entries = [entry(1, 'a')]
    remote.submitInspection = async () => {
      throw Object.assign(new Error('Failed to fetch'), {})
    }

    await run()

    expect(outbox.rescheduled).toHaveLength(1)
    expect(new Date(outbox.rescheduled[0]!.at).getTime()).toBeGreaterThan(NOW.getTime())
    expect(outbox.entries).toHaveLength(1)
  })

  it('parks an entry once it exhausts its attempts', async () => {
    outbox.entries = [entry(1, 'a', MAX_ATTEMPTS - 1)]
    remote.submitInspection = async () => {
      throw Object.assign(new Error('Failed to fetch'), {})
    }

    const r = await run()

    expect(r.parked).toBe(1)
    expect(outbox.entries).toHaveLength(0)
  })
})

describe('permanent failures', () => {
  it('parks immediately — more attempts cannot help', async () => {
    outbox.entries = [entry(1, 'a')]
    remote.submitInspection = async () => {
      throw Object.assign(new Error('invalid input syntax'), { status: 400 })
    }

    const r = await run()

    expect(r.parked).toBe(1)
    expect(outbox.rescheduled).toEqual([])
    expect(outbox.parked[0]?.error).toContain('invalid input syntax')
  })

  it('does not let a poisoned entry block the ones behind it', async () => {
    outbox.entries = [entry(1, 'bad'), entry(2, 'good')]
    remote.submitInspection = async (p) => {
      if (p.inspection.id === 'bad') throw Object.assign(new Error('bad payload'), { status: 422 })
      submitted.push(p.inspection.id)
    }

    const r = await run()

    expect(submitted).toEqual(['good'])
    expect(r.parked).toBe(1)
    expect(r.uploaded).toBe(1)
  })
})

describe('missing local data', () => {
  it('drops the entry when the inspection no longer exists on this device', async () => {
    outbox.entries = [entry(1, 'ghost')]
    source.loadForUpload = async () => null

    await run()

    expect(outbox.entries).toHaveLength(0)
    expect(outbox.parked).toEqual([])
    expect(submitted).toEqual([])
  })
})
