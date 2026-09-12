import { createFileRoute } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { countItems } from '@/modules/template/domain/template'
import { queries } from '@/app/container'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  // The local database IS the state. These re-render on their own whenever
  // anything writes — another component, the sync worker, even another tab.
  const draftCount = useLiveQuery(queries.draftCount, [], 0)
  const template = useLiveQuery(queries.activeTemplate, [], null)

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Lista de chequeo</h1>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-500">Plantilla activa</dt>
          <dd className="font-medium">
            {template ? `${template.name} · v${template.version}` : 'Cargando…'}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-500">Ítems</dt>
          <dd className="font-medium">{template ? countItems(template) : '—'}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-sm text-slate-500">Borradores</dt>
          <dd className="font-medium">{draftCount}</dd>
        </div>
      </dl>
      <p className="text-sm text-slate-500">Fase 1 — dominio y base local listos.</p>
    </section>
  )
}
