/**
 * Templates live in the database, not in the code.
 *
 * On first run the bundled seed is written locally so the app works before it
 * has ever seen the server. Afterwards, templates are pull-only: server ->
 * device, never back.
 */
import type { Template } from '../domain/template'
import { db as defaultDb, type FaenaDB } from '@/shared/db/db'
import { CAMION_MULTIUSO_V1 } from './template-seed'

export async function ensureSeeded(db: FaenaDB = defaultDb): Promise<void> {
  const existing = await db.templates.get(CAMION_MULTIUSO_V1.id)
  if (!existing) await db.templates.put(CAMION_MULTIUSO_V1)
}

export async function getActiveTemplate(db: FaenaDB = defaultDb): Promise<Template | null> {
  const active = await db.templates.where('isActive').equals(1).toArray()
  // Highest version wins when more than one is active.
  return active.sort((a, b) => b.version - a.version)[0] ?? null
}

export const getTemplate = (id: string, db: FaenaDB = defaultDb): Promise<Template | undefined> =>
  db.templates.get(id)
