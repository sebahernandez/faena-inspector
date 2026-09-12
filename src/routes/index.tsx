import { createFileRoute, Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { queries } from '@/app/container'
import { countItems } from '@/modules/template/domain/template'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  // The local database IS the state. These update on their own on every write.
  const drafts = useLiveQuery(queries.drafts, [], [])
  const signed = useLiveQuery(queries.submitted, [], [])
  const pending = useLiveQuery(queries.pendingUpload, [], [])
  const template = useLiveQuery(queries.activeTemplate, [], null)

  return (
    <section className="space-y-6">
      {pending.length > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{pending.length}</strong>{' '}
          {pending.length === 1 ? 'inspección firmada sin enviar' : 'inspecciones firmadas sin enviar'}.
          Se subirán solas cuando haya señal.
        </p>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Inspecciones</h1>
          {template && (
            <p className="text-sm text-slate-500">
              {template.name} · v{template.version} · {countItems(template)} ítems
            </p>
          )}
        </div>
        <Link
          to="/inspeccion/nueva"
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white"
        >
          Nueva
        </Link>
      </div>

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          No hay inspecciones en curso.
        </p>
      ) : (
        <ul className="space-y-2">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                to="/inspeccion/$id"
                params={{ id: draft.id }}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
              >
                <span>
                  <span className="block font-semibold">{draft.plate}</span>
                  <span className="block text-sm text-slate-500">
                    {draft.driverName ?? 'Sin conductor'} ·{' '}
                    {format(new Date(draft.inspectedAt), 'dd/MM/yyyy HH:mm')}
                  </span>
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  Borrador
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {signed.length > 0 && (
        <div>
          <h2 className="mb-2 text-base font-semibold">Firmadas</h2>
          <ul className="space-y-2">
            {signed.map((item) => (
              <li key={item.id}>
                <Link
                  to="/inspeccion/$id/documento"
                  params={{ id: item.id }}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
                >
                  <span>
                    <span className="block font-semibold">{item.plate}</span>
                    <span className="block text-sm text-slate-500">
                      {item.declaredByName ?? '—'} ·{' '}
                      {format(new Date(item.inspectedAt), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      item.syncState === 'synced'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {item.syncState === 'synced' ? 'Enviada' : 'Por enviar'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
