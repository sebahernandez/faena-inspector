/**
 * The device seed and the server seed must be the same thing.
 *
 * An answer points at an item by id. If the bundled template used one set of
 * ids and the database another, every inspection filled in before the first
 * sync would upload answers pointing at items that do not exist — and a signed
 * document would come back blank. This test is the guard.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAMION_MULTIUSO_V1, TEMPLATE_UUID } from './template-seed'

const SQL = readFileSync(join(process.cwd(), 'supabase/seed.sql'), 'utf8')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const sqlItemIds = [...SQL.matchAll(/^\s+\('([0-9a-f-]{36})',\s*'[0-9a-f-]{36}',/gm)].map((m) => m[1])
const sqlSectionIds = [
  ...SQL.matchAll(/insert into template_sections[\s\S]*?values \('([0-9a-f-]{36})'/g),
].map((m) => m[1])

const tsItemIds = CAMION_MULTIUSO_V1.sections.flatMap((s) => s.items.map((i) => i.id))
const tsSectionIds = CAMION_MULTIUSO_V1.sections.map((s) => s.id)

describe('seed ids', () => {
  it('are well-formed UUIDs, not ad-hoc strings', () => {
    expect(TEMPLATE_UUID).toMatch(UUID)
    for (const id of [...tsSectionIds, ...tsItemIds]) expect(id).toMatch(UUID)
  })

  it('are unique across the whole template', () => {
    const all = [TEMPLATE_UUID, ...tsSectionIds, ...tsItemIds]
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('supabase/seed.sql parity', () => {
  it('was regenerated — run `npm run seed:generate` if this fails', () => {
    expect(sqlItemIds).toEqual(tsItemIds)
    expect(sqlSectionIds).toEqual(tsSectionIds)
  })

  it('carries all 51 items', () => {
    expect(sqlItemIds).toHaveLength(51)
  })

  it('uses the same template id on both sides', () => {
    expect(SQL).toContain(TEMPLATE_UUID)
    expect(CAMION_MULTIUSO_V1.id).toBe(TEMPLATE_UUID)
  })

  it('carries the corrected labels, not the source typos', () => {
    expect(SQL).not.toMatch(/Soladura|Vávula|buene/)
    expect(SQL).toContain('Soldadura y uniones sin grietas visibles')
  })

  it('escapes quotes so the SQL cannot break', () => {
    // no stray odd-quoted literals
    const inserts = SQL.split('\n').filter((l) => l.trim().startsWith("('0000"))
    for (const line of inserts) expect((line.match(/'/g) ?? []).length % 2).toBe(0)
  })
})
