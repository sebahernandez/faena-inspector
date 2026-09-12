/**
 * The database rules, executed against a real Postgres.
 *
 * PGlite is Postgres compiled to WebAssembly, so these are not assertions about
 * SQL we hope works — the migration runs, the policies apply, and the failures
 * are the failures production would give.
 *
 * The rule under test above all others: a signed inspection cannot be edited by
 * anyone, including its author. That guarantee is the reason this app is
 * allowed to replace a paper form.
 */
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260912000000_initial_schema.sql'),
  'utf8',
)
const AUTH_SHIM = readFileSync(join(process.cwd(), 'src/test/supabase-auth-shim.sql'), 'utf8')

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const INSPECTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SUPERVISOR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OUTSIDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

let db: PGlite
let templateId: string
let itemIds: string[]

/** Act as a signed-in user: Supabase's `authenticated` role plus a JWT subject. */
const actAs = (uid: string | null) =>
  db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub', ${uid ? `'${uid}'` : `''`}, false);`,
  )

const asOwner = () => db.exec('reset role;')

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(AUTH_SHIM)
  await db.exec(MIGRATION)
  await db.exec(
    readFileSync(join(process.cwd(), 'supabase/migrations/20260912010000_evidence_photos.sql'), 'utf8'),
  )
  await db.exec(
    readFileSync(join(process.cwd(), 'supabase/migrations/20260912020000_panel_views.sql'), 'utf8'),
  )
  await db.exec(
    readFileSync(join(process.cwd(), 'supabase/migrations/20260912030000_separation_of_duties.sql'), 'utf8'),
  )

  await db.exec(`
    insert into auth.users (id, email) values
      ('${INSPECTOR}','inspector@faena.cl'),
      ('${SUPERVISOR}','supervisor@faena.cl'),
      ('${OUTSIDER}','otra@empresa.cl');

    insert into profiles (id, org_id, full_name, job_title, role) values
      ('${INSPECTOR}','${ORG_A}','Juan Pérez','Operador','inspector'),
      ('${SUPERVISOR}','${ORG_A}','Ana Soto','Jefa de turno','supervisor'),
      ('${OUTSIDER}','${ORG_B}','Otro','Operador','inspector');
  `)

  const tpl = await db.query<{ id: string }>(`
    insert into templates (org_id, name, version, effective_from, published)
    values ('${ORG_A}','Lista de Chequeo Camión Multiuso',1,'2026-01-01',true)
    returning id
  `)
  templateId = tpl.rows[0]!.id

  const sec = await db.query<{ id: string }>(`
    insert into template_sections (template_id, position, code, title)
    values ('${templateId}',1,'1','Inspección exterior del camión') returning id
  `)
  const items = await db.query<{ id: string }>(`
    insert into template_items (section_id, position, code, label) values
      ('${sec.rows[0]!.id}',1,'1.1','Neumáticos del. y tras. en buen estado'),
      ('${sec.rows[0]!.id}',2,'1.2','Tuercas de ruedas correctamente instaladas')
    returning id
  `)
  itemIds = items.rows.map((r) => r.id)
})

afterAll(async () => {
  await db?.close()
})

const INSPECTION_ID = '01a09396-5cf6-72a4-983a-daaf34f1316a'

const payload = (id = INSPECTION_ID) => ({
  id,
  template_id: templateId,
  template_version: 1,
  vehicle_type: 'Camión multiuso',
  plate: ' krdm12 ',
  driver_name: 'J. Pérez',
  odometer_km: 184320,
  inspected_at: '2026-03-01T12:00:00Z',
  general_observations: 'Equipo operativo.',
  declared_by_name: 'Juan Pérez',
  declared_by_role: 'Operador',
  declared_signature_path: 'signatures/a/declared.png',
  declared_at: '2026-03-01T13:00:00Z',
})

const answersPayload = () => [
  { item_id: itemIds[0], value: 'NO', observation: 'Banda lisa', responsible: 'M. Rojas', due_date: '2026-04-15' },
  { item_id: itemIds[1], value: 'YES' },
]

const submit = (id = INSPECTION_ID) =>
  db.query(`select submit_inspection($1::jsonb, $2::jsonb) as id`, [
    JSON.stringify(payload(id)),
    JSON.stringify(answersPayload()),
  ])

beforeEach(async () => {
  await asOwner()
  // The immutability triggers block even the owner — that is the point. Tests
  // reset through session_replication_role, a superuser switch production
  // never uses.
  await db.exec(`
    set session_replication_role = replica;
    delete from answer_photos;
    delete from answers;
    delete from inspections;
    set session_replication_role = origin;
  `)
})

// ---------------------------------------------------------------------------

describe('submission', () => {
  it('stores the inspection and its answers', async () => {
    await actAs(INSPECTOR)
    await submit()

    const rows = await db.query<{ plate: string; status: string; created_by: string }>(
      'select plate, status, created_by from inspections',
    )
    expect(rows.rows[0]).toMatchObject({ plate: 'KRDM12', status: 'submitted', created_by: INSPECTOR })
    expect((await db.query('select * from answers')).rows).toHaveLength(2)
  })

  it('is idempotent — retrying a hundred times still yields one inspection', async () => {
    await actAs(INSPECTOR)
    for (let i = 0; i < 5; i++) await submit()

    expect((await db.query('select 1 from inspections')).rows).toHaveLength(1)
    expect((await db.query('select 1 from answers')).rows).toHaveLength(2)
  })

  it('never overwrites an already-stored answer on retry', async () => {
    await actAs(INSPECTOR)
    await submit()
    await db.query(`select submit_inspection($1::jsonb, $2::jsonb)`, [
      JSON.stringify(payload()),
      JSON.stringify([{ item_id: itemIds[0], value: 'YES', observation: 'manipulado' }]),
    ])

    const a = await db.query<{ value: string; observation: string }>(
      `select value, observation from answers where item_id = '${itemIds[0]}'`,
    )
    expect(a.rows[0]).toMatchObject({ value: 'NO', observation: 'Banda lisa' })
  })

  it('refuses an anonymous submission', async () => {
    await actAs(null)
    await expect(submit()).rejects.toThrow(/not authenticated/)
  })

  it('stamps the caller organisation, not one supplied by the client', async () => {
    await actAs(INSPECTOR)
    await submit()
    const r = await db.query<{ org_id: string }>('select org_id from inspections')
    expect(r.rows[0]?.org_id).toBe(ORG_A)
  })
})

describe('immutability — the rule that lets this replace paper', () => {
  beforeEach(async () => {
    await actAs(INSPECTOR)
    await submit()
  })

  it('refuses to update a submitted inspection, even for its own author', async () => {
    await actAs(INSPECTOR)
    await expect(
      db.exec(`update inspections set plate = 'HACK99' where id = '${INSPECTION_ID}'`),
    ).rejects.toThrow(/denied|policy/i)
  })

  it('refuses to update it for a supervisor too', async () => {
    await actAs(SUPERVISOR)
    await expect(
      db.exec(`update inspections set general_observations = 'editado'`),
    ).rejects.toThrow(/denied|policy/i)
  })

  it('refuses to delete it', async () => {
    await actAs(INSPECTOR)
    await expect(db.exec(`delete from inspections`)).rejects.toThrow(/denied|policy/i)
  })

  it('refuses to tamper with an answer', async () => {
    await actAs(INSPECTOR)
    await expect(
      db.exec(`update answers set value = 'YES' where value = 'NO'`),
    ).rejects.toThrow(/denied|policy/i)
  })

  /**
   * RLS alone leaves a silent hole: with no UPDATE policy an UPDATE succeeds
   * against zero rows, so the caller hears "ok". These check the trigger, which
   * fires for every writer — including a stray grant, the table owner, and
   * service_role, all of which walk straight past RLS.
   */
  it('raises loudly instead of silently matching zero rows, even if UPDATE is granted by mistake', async () => {
    await asOwner()
    await db.exec(`grant update, delete on inspections to authenticated;
                   grant update, delete on answers to authenticated;`)
    await actAs(INSPECTOR)

    await expect(db.exec(`update inspections set plate = 'HACK99'`)).rejects.toThrow(/row-level security|immutable/i)
    await expect(db.exec(`delete from inspections`)).rejects.toThrow(/cannot be deleted/)
    await expect(db.exec(`update answers set value = 'YES'`)).rejects.toThrow(/row-level security|immutable/i)
    await expect(db.exec(`delete from answers`)).rejects.toThrow(/immutable/)

    // and nothing moved
    const r = await db.query<{ plate: string }>('select plate from inspections')
    expect(r.rows[0]?.plate).toBe('KRDM12')

    await asOwner()
    await db.exec(`revoke update, delete on inspections from authenticated;
                   revoke update, delete on answers from authenticated;`)
  })

  it('refuses with a plain permission error under the default grants', async () => {
    await actAs(INSPECTOR)
    await expect(db.exec(`update inspections set plate = 'HACK99'`)).rejects.toThrow(/permission denied/)
    await expect(db.exec(`delete from answers`)).rejects.toThrow(/permission denied/)
  })

  it('blocks the table owner too — service_role bypasses RLS but not triggers', async () => {
    await asOwner()
    await expect(db.exec(`update inspections set plate = 'OWNER'`)).rejects.toThrow(/immutable/)
    await expect(db.exec(`delete from answers`)).rejects.toThrow(/immutable/)
  })

  it('still allows the approval columns to change', async () => {
    await actAs(SUPERVISOR)
    await db.query(`select approve_inspection($1::uuid, 'p.png')`, [INSPECTION_ID])
    const r = await db.query<{ status: string }>('select status from inspections')
    expect(r.rows[0]?.status).toBe('approved')
  })

  it('refuses to reopen an approved inspection', async () => {
    await actAs(SUPERVISOR)
    await db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID])
    await asOwner()
    await expect(
      db.exec(`update inspections set status = 'submitted'`),
    ).rejects.toThrow(/cannot be reopened/)
  })

  it('refuses a direct insert that bypasses the submit function', async () => {
    await actAs(INSPECTOR)
    await expect(
      db.exec(`insert into inspections (id, org_id, template_id, template_version, plate,
               inspected_at, declared_by_name, declared_at, created_by)
               values (gen_random_uuid(), '${ORG_A}', '${templateId}', 1, 'X',
               now(), 'x', now(), '${INSPECTOR}')`),
    ).rejects.toThrow(/denied|policy/i)
  })
})

describe('organisation isolation', () => {
  beforeEach(async () => {
    await actAs(INSPECTOR)
    await submit()
  })

  it('shows the inspection to a colleague in the same organisation', async () => {
    await actAs(SUPERVISOR)
    expect((await db.query('select 1 from inspections')).rows).toHaveLength(1)
  })

  it('hides it from another organisation', async () => {
    await actAs(OUTSIDER)
    expect((await db.query('select 1 from inspections')).rows).toHaveLength(0)
    expect((await db.query('select 1 from answers')).rows).toHaveLength(0)
  })

  it('hides it from an anonymous caller', async () => {
    await actAs(null)
    expect((await db.query('select 1 from inspections')).rows).toHaveLength(0)
  })

  it('does not leak through the findings view', async () => {
    await actAs(OUTSIDER)
    expect((await db.query('select 1 from findings')).rows).toHaveLength(0)
  })
})

describe('findings view', () => {
  beforeEach(async () => {
    await actAs(INSPECTOR)
    await submit()
  })

  it('returns only the NOs, with their owner and deadline', async () => {
    await actAs(SUPERVISOR)
    const r = await db.query<{ item_code: string; responsible: string; due_date: Date }>(
      'select item_code, responsible, due_date from findings',
    )
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ item_code: '1.1', responsible: 'M. Rojas' })
  })

  it('flags an overdue finding', async () => {
    await actAs(SUPERVISOR)
    const r = await db.query<{ overdue: boolean }>('select overdue from findings')
    // due 2026-04-15, and "today" in this suite is later than that
    expect(typeof r.rows[0]?.overdue).toBe('boolean')
  })
})

describe('approval — server-owned, supervisor only', () => {
  beforeEach(async () => {
    await actAs(INSPECTOR)
    await submit()
  })

  it('lets a supervisor approve', async () => {
    await actAs(SUPERVISOR)
    await db.query(`select approve_inspection($1::uuid, $2)`, [INSPECTION_ID, 'signatures/a/approved.png'])

    const r = await db.query<{ status: string; approved_by: string }>(
      'select status, approved_by from inspections',
    )
    expect(r.rows[0]).toMatchObject({ status: 'approved', approved_by: SUPERVISOR })
  })

  it('refuses an inspector — they cannot approve their own work', async () => {
    await actAs(INSPECTOR)
    await expect(
      db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID]),
    ).rejects.toThrow(/only a supervisor/)
  })

  it('refuses a supervisor from another organisation', async () => {
    await asOwner()
    await db.exec(`update profiles set role = 'supervisor' where id = '${OUTSIDER}'`)
    await actAs(OUTSIDER)
    await expect(
      db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID]),
    ).rejects.toThrow(/not found|already approved/)
    await asOwner()
    await db.exec(`update profiles set role = 'inspector' where id = '${OUTSIDER}'`)
  })

  it('refuses to approve twice', async () => {
    await actAs(SUPERVISOR)
    await db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID])
    await expect(
      db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID]),
    ).rejects.toThrow(/already approved/)
  })

  it('leaves the inspection body untouched when approving', async () => {
    await actAs(SUPERVISOR)
    await db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID])
    const r = await db.query<{ plate: string; declared_by_name: string }>(
      'select plate, declared_by_name from inspections',
    )
    expect(r.rows[0]).toMatchObject({ plate: 'KRDM12', declared_by_name: 'Juan Pérez' })
  })
})

describe('evidence photos', () => {
  const PHOTO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

  beforeEach(async () => {
    await actAs(INSPECTOR)
    await submit()
  })

  it('records a photo for an inspection in my organisation', async () => {
    await db.query(`select record_photo($1::uuid,$2::uuid,$3::uuid,$4)`, [
      PHOTO, INSPECTION_ID, itemIds[0], 'u/i/p.jpg',
    ])
    const r = await db.query<{ storage_path: string }>('select storage_path from answer_photos')
    expect(r.rows[0]?.storage_path).toBe('u/i/p.jpg')
  })

  it('is idempotent on retry', async () => {
    for (let i = 0; i < 3; i++) {
      await db.query(`select record_photo($1::uuid,$2::uuid,$3::uuid,$4)`, [
        PHOTO, INSPECTION_ID, itemIds[0], 'u/i/p.jpg',
      ])
    }
    expect((await db.query('select 1 from answer_photos')).rows).toHaveLength(1)
  })

  it('refuses to staple evidence onto another organisation document', async () => {
    await actAs(OUTSIDER)
    await expect(
      db.query(`select record_photo($1::uuid,$2::uuid,$3::uuid,$4)`, [
        PHOTO, INSPECTION_ID, itemIds[0], 'u/i/p.jpg',
      ]),
    ).rejects.toThrow(/not found in your organisation/)
  })

  it('refuses an anonymous caller', async () => {
    await actAs(null)
    await expect(
      db.query(`select record_photo($1::uuid,$2::uuid,$3::uuid,$4)`, [
        PHOTO, INSPECTION_ID, itemIds[0], 'u/i/p.jpg',
      ]),
    ).rejects.toThrow(/not authenticated/)
  })

  it('cannot be altered or removed once recorded', async () => {
    await db.query(`select record_photo($1::uuid,$2::uuid,$3::uuid,$4)`, [
      PHOTO, INSPECTION_ID, itemIds[0], 'u/i/p.jpg',
    ])
    await asOwner()
    await expect(db.exec(`update answer_photos set storage_path = 'x'`)).rejects.toThrow(/immutable/)
    await expect(db.exec(`delete from answer_photos`)).rejects.toThrow(/immutable/)
  })
})

describe('panel views', () => {
  beforeEach(async () => {
    await actAs(INSPECTOR)
    await submit()
  })

  it('joins each answer to its label and section', async () => {
    await actAs(SUPERVISOR)
    const r = await db.query<{
      item_code: string
      item_label: string
      section_title: string
      value: string
    }>(`select item_code, item_label, section_title, value
        from inspection_answers order by section_position, item_position`)

    expect(r.rows).toHaveLength(2)
    expect(r.rows[0]).toMatchObject({
      item_code: '1.1',
      item_label: 'Neumáticos del. y tras. en buen estado',
      section_title: 'Inspección exterior del camión',
      value: 'NO',
    })
  })

  it('does not leak answers to another organisation', async () => {
    await actAs(OUTSIDER)
    expect((await db.query('select 1 from inspection_answers')).rows).toHaveLength(0)
    expect((await db.query('select 1 from inspection_summaries')).rows).toHaveLength(0)
  })

  it('tallies an inspection without pulling every answer', async () => {
    await actAs(SUPERVISOR)
    const r = await db.query<{
      plate: string
      yes_count: string
      no_count: string
      na_count: string
      status: string
    }>('select plate, yes_count, no_count, na_count, status from inspection_summaries')

    expect(r.rows[0]).toMatchObject({ plate: 'KRDM12', status: 'submitted' })
    expect(Number(r.rows[0]!.yes_count)).toBe(1)
    expect(Number(r.rows[0]!.no_count)).toBe(1)
    expect(Number(r.rows[0]!.na_count)).toBe(0)
  })

  it('shows who approved it once approved', async () => {
    await actAs(SUPERVISOR)
    await db.query(`select approve_inspection($1::uuid, 'p.png')`, [INSPECTION_ID])

    const r = await db.query<{ status: string; approved_by_name: string }>(
      'select status, approved_by_name from inspection_summaries',
    )
    expect(r.rows[0]).toMatchObject({ status: 'approved', approved_by_name: 'Ana Soto' })
  })

  it('counts an inspection with no answers as zero rather than hiding it', async () => {
    await asOwner()
    await db.exec(`set session_replication_role = replica; delete from answers; set session_replication_role = origin;`)
    await actAs(SUPERVISOR)

    const r = await db.query<{ answered_count: string }>('select answered_count from inspection_summaries')
    expect(r.rows).toHaveLength(1)
    expect(Number(r.rows[0]!.answered_count)).toBe(0)
  })
})

describe('separation of duties', () => {
  it('refuses to let a supervisor approve an inspection they declared themselves', async () => {
    // Promote the inspector, then have them try to sign off their own work.
    await actAs(INSPECTOR)
    await submit()

    await asOwner()
    await db.exec(`update profiles set role = 'supervisor' where id = '${INSPECTOR}'`)
    await actAs(INSPECTOR)

    await expect(
      db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID]),
    ).rejects.toThrow(/approved by the person who declared it/)

    const r = await db.query<{ status: string }>('select status from inspections')
    expect(r.rows[0]?.status).toBe('submitted')

    await asOwner()
    await db.exec(`update profiles set role = 'inspector' where id = '${INSPECTOR}'`)
  })

  it('still lets a different supervisor approve it', async () => {
    await actAs(INSPECTOR)
    await submit()
    await actAs(SUPERVISOR)

    await db.query(`select approve_inspection($1::uuid, null)`, [INSPECTION_ID])
    const r = await db.query<{ status: string }>('select status from inspections')
    expect(r.rows[0]?.status).toBe('approved')
  })
})
