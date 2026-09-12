/**
 * The seam that only breaks in production: local database -> payload -> RPC.
 *
 * Both ends are real here. Dexie runs on fake-indexeddb and the server is
 * PGlite running the actual migration, so a renamed column or a mistyped key
 * fails in this suite instead of on a truck.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createTestDb, type FaenaDB } from '@/shared/db/db'
import { createDexieInspectionRepository } from '@/modules/inspection/infrastructure/dexie-inspection.repository'
import { createDexieSyncSource } from '@/modules/sync/infrastructure/dexie-sync-source'
import { createDexieOutboxRepository } from '@/modules/sync/infrastructure/dexie-outbox.repository'
import { drainOutbox } from '@/modules/sync/application/drain-outbox'
import { CAMION_MULTIUSO_V1, TEMPLATE_UUID, itemUuid } from '@/modules/template/infrastructure/template-seed'
import type { Inspection } from '@/modules/inspection/domain/inspection'
import type { SubmitPayload } from '@/modules/inspection/application/submit-payload'
import type { RemoteGateway } from '@/modules/sync/application/ports'

const ORG = '11111111-1111-4111-8111-111111111111'
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const INSPECTION_ID = '01a09396-5cf6-72a4-983a-daaf34f1316a'

let pg: PGlite
let local: FaenaDB

beforeAll(async () => {
  pg = await PGlite.create()
  await pg.exec(readFileSync(join(process.cwd(), 'src/test/supabase-auth-shim.sql'), 'utf8'))
  await pg.exec(
    readFileSync(join(process.cwd(), 'supabase/migrations/20260912000000_initial_schema.sql'), 'utf8'),
  )
  await pg.exec(`
    insert into auth.users (id, email) values ('${USER}','inspector@faena.cl');
    insert into profiles (id, org_id, full_name, role)
      values ('${USER}','${ORG}','Juan Pérez','inspector');
  `)

  // Seed the server with the same template the device carries.
  await pg.exec(`
    insert into templates (id, org_id, name, version, effective_from, published)
    values ('${TEMPLATE_UUID}','${ORG}','${CAMION_MULTIUSO_V1.name}',1,'2026-01-01',true);
  `)
  for (const section of CAMION_MULTIUSO_V1.sections) {
    await pg.query(
      `insert into template_sections (id, template_id, position, code, title) values ($1,$2,$3,$4,$5)`,
      [section.id, TEMPLATE_UUID, section.position, section.code, section.title],
    )
    for (const item of section.items) {
      await pg.query(
        `insert into template_items (id, section_id, position, code, label) values ($1,$2,$3,$4,$5)`,
        [item.id, section.id, item.position, item.code, item.label],
      )
    }
  }
  await pg.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${USER}',false);`,
  )
})

afterAll(async () => {
  await pg?.close()
  await local?.delete()
})

const draft = (): Inspection => ({
  id: INSPECTION_ID,
  templateId: TEMPLATE_UUID,
  templateVersion: 1,
  vehicleType: 'Camión multiuso',
  plate: 'KRDM12',
  brand: 'Mercedes-Benz',
  model: 'Actros 2644',
  year: 2021,
  driverName: 'J. Pérez',
  odometerKm: 184320,
  inspectedAt: '2026-03-01T12:00:00.000Z',
  generalObservations: 'Equipo operativo.',
  declaredByName: null,
  declaredByRole: null,
  declaredAt: null,
  approvedByName: null,
  approvedAt: null,
  status: 'draft',
  syncState: 'local',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
})

/** A gateway that talks to PGlite instead of the network. */
const pgGateway = (onSubmit?: () => void): RemoteGateway => ({
  canSync: async () => true,
  uploadSignature: async () => `${USER}/${INSPECTION_ID}/declared.png`,
  uploadPhoto: async (p) => `${USER}/${p.inspectionId}/${p.id}.jpg`,
  submitInspection: async (payload: SubmitPayload) => {
    onSubmit?.()
    await pg.query(`select submit_inspection($1::jsonb, $2::jsonb)`, [
      JSON.stringify(payload.inspection),
      JSON.stringify(payload.answers),
    ])
  },
})

beforeEach(async () => {
  local = createTestDb(`roundtrip-${Date.now()}-${Math.random()}`)
  await local.open()
  // The reset needs superuser; go back to acting as the inspector afterwards.
  await pg.exec(`
    reset role;
    set session_replication_role = replica;
    delete from answers; delete from inspections;
    set session_replication_role = origin;
    set role authenticated;
    select set_config('request.jwt.claim.sub','${USER}',false);
  `)
})

const prepareSigned = async () => {
  const repo = createDexieInspectionRepository(local)
  await repo.create(draft())
  await repo.putAnswer({
    inspectionId: INSPECTION_ID,
    itemId: itemUuid(1, 1),
    value: 'NO',
    observation: 'Banda lisa',
    responsible: 'M. Rojas',
    dueDate: '2026-04-15',
    updatedAt: '2026-03-01T12:30:00.000Z',
  })
  await repo.putAnswer({
    inspectionId: INSPECTION_ID,
    itemId: itemUuid(1, 2),
    value: 'YES',
    observation: null,
    responsible: null,
    dueDate: null,
    updatedAt: '2026-03-01T12:31:00.000Z',
  })
  await repo.submit(INSPECTION_ID, new Blob(['png'], { type: 'image/png' }), {
    name: 'Juan Pérez',
    role: 'Operador',
  })
}

const drain = (remote: RemoteGateway) =>
  drainOutbox({
    outbox: createDexieOutboxRepository(local),
    remote,
    source: createDexieSyncSource(local),
    // Real time: `submit` stamps nextAttemptAt with the actual clock, so a
    // fixed past date would leave every entry "not due yet".
    clock: { now: () => new Date() },
    random: () => 1,
  })

describe('local to server', () => {
  it('carries the inspection through unchanged', async () => {
    await prepareSigned()
    const r = await drain(pgGateway())
    expect(r.uploaded).toBe(1)

    const row = await pg.query<{
      plate: string
      driver_name: string
      odometer_km: number
      declared_by_name: string
      org_id: string
      created_by: string
      status: string
      template_version: number
    }>(`select plate, driver_name, odometer_km, declared_by_name, org_id, created_by, status,
               template_version from inspections`)

    expect(row.rows[0]).toMatchObject({
      plate: 'KRDM12',
      driver_name: 'J. Pérez',
      odometer_km: 184320,
      declared_by_name: 'Juan Pérez',
      org_id: ORG,
      created_by: USER,
      status: 'submitted',
      template_version: 1,
    })
  })

  it('carries the finding with its owner and deadline', async () => {
    await prepareSigned()
    await drain(pgGateway())

    const f = await pg.query<{ item_code: string; responsible: string; observation: string }>(
      `select item_code, responsible, observation from findings`,
    )
    expect(f.rows).toHaveLength(1)
    expect(f.rows[0]).toMatchObject({
      item_code: '1.1',
      responsible: 'M. Rojas',
      observation: 'Banda lisa',
    })
  })

  it('attaches the uploaded signature path', async () => {
    await prepareSigned()
    await drain(pgGateway())

    const r = await pg.query<{ declared_signature_path: string }>(
      'select declared_signature_path from inspections',
    )
    expect(r.rows[0]?.declared_signature_path).toBe(`${USER}/${INSPECTION_ID}/declared.png`)
  })

  it('clears the outbox and frees the signature blob', async () => {
    await prepareSigned()
    await drain(pgGateway())

    expect(await local.outbox.count()).toBe(0)
    const row = await local.inspections.get(INSPECTION_ID)
    expect(row?.syncState).toBe('synced')
    expect(row?.declaredSignature).toBeNull()
  })
})

describe('a dropped connection after the server committed', () => {
  it('does not create a second inspection on retry', async () => {
    await prepareSigned()

    // The server commits, then the reply never arrives.
    let calls = 0
    await expect(
      drain(
        pgGateway(() => {
          calls++
        }) as RemoteGateway,
      ),
    ).resolves.toBeTruthy()

    // Force the entry back into the queue as if the ack had been lost.
    await local.outbox.put({
      dedupeKey: `inspection:${INSPECTION_ID}`,
      kind: 'inspection',
      entityId: INSPECTION_ID,
      attempts: 1,
      nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
      lastError: 'Failed to fetch',
      createdAt: new Date().toISOString(),
    })
    await local.inspections.update(INSPECTION_ID, { syncState: 'queued' })

    await drain(pgGateway(() => { calls++ }))

    expect(calls).toBe(2)
    expect((await pg.query('select 1 from inspections')).rows).toHaveLength(1)
    expect((await pg.query('select 1 from answers')).rows).toHaveLength(2)
  })
})

describe('a server that refuses the payload', () => {
  it('parks the entry instead of retrying forever', async () => {
    await prepareSigned()

    const broken: RemoteGateway = {
      ...pgGateway(),
      submitInspection: async () => {
        throw Object.assign(new Error('invalid input syntax for type uuid'), { status: 400 })
      },
    }

    const r = await drain(broken)

    expect(r.parked).toBe(1)
    const parked = await local.outbox.toArray()
    expect(parked[0]?.parked).toBe(1)
    expect(parked[0]?.lastError).toContain('invalid input syntax')
  })
})
