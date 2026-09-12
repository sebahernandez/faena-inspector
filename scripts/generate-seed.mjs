/**
 * Regenerates supabase/seed.sql from the TypeScript template seed.
 *
 * The device and the server must agree on the 51 item ids forever: an answer
 * points at an item by id, and a signed inspection has to reprint identically
 * years later. Generating one from the other removes the chance of drift.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('src/modules/template/infrastructure/template-seed.ts', 'utf8')

const sections = [...src.matchAll(/section\((\d+),\s*'([^']+)',\s*\[([\s\S]*?)\]\)/g)].map(
  ([, position, title, body]) => ({
    position: Number(position),
    title,
    labels: [...body.matchAll(/^\s+'((?:[^'\\]|\\.)*)',$/gm)].map((m) => m[1].replace(/\\'/g, "'")),
  }),
)

const q = (s) => `'${s.replace(/'/g, "''")}'`
// Must stay identical to template-seed.ts. A test fails if they drift.
const TEMPLATE_UUID = '00000000-0000-4000-8000-000000000001'
const sectionUuid = (p) => `00000000-0000-4000-8000-0000000001${String(p).padStart(2, '0')}`
const itemUuid = (p, i) =>
  `00000000-0000-4000-8000-0000${String(p).padStart(4, '0')}${String(i).padStart(4, '0')}`
const total = sections.reduce((n, s) => n + s.labels.length, 0)

const lines = [
  '-- GENERATED FILE — do not edit by hand.',
  '-- Run: npm run seed:generate',
  '--',
  '-- Source: src/modules/template/infrastructure/template-seed.ts',
  `-- ${sections.length} sections, ${total} items.`,
  '--',
  '-- Set :org_id before running, e.g.',
  "--   psql -v org_id=\"'<uuid>'\" -f supabase/seed.sql",
  '',
  'begin;',
  '',
  'insert into templates (id, org_id, name, version, effective_from, published)',
  `values ('${TEMPLATE_UUID}', :org_id,`,
  "        'Lista de Chequeo Camión Multiuso', 1, '2026-01-01', true)",
  'on conflict (org_id, name, version) do nothing;',
  '',
]

for (const s of sections) {
  const sectionId = `'${sectionUuid(s.position)}'`
  lines.push(
    `-- ${s.position}.- ${s.title.toUpperCase()} (${s.labels.length} ítems)`,
    'insert into template_sections (id, template_id, position, code, title)',
    `values (${sectionId}, '${TEMPLATE_UUID}', ${s.position}, '${s.position}', ${q(s.title)})`,
    'on conflict (template_id, position) do nothing;',
    '',
    'insert into template_items (id, section_id, position, code, label) values',
  )
  lines.push(
    s.labels
      .map((label, i) => {
        const itemId = `'${itemUuid(s.position, i + 1)}'`
        return `  (${itemId}, ${sectionId}, ${i + 1}, '${s.position}.${i + 1}', ${q(label)})`
      })
      .join(',\n') + '\non conflict (section_id, position) do nothing;',
    '',
  )
}

lines.push('commit;', '')
writeFileSync('supabase/seed.sql', lines.join('\n'))
console.log(`supabase/seed.sql: ${sections.length} sections, ${total} items`)
