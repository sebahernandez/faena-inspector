import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format } from 'date-fns'
import { supervision } from '@/app/container'
import { useSession } from '@/modules/auth/ui/use-session'
import { PanelGate } from '@/modules/supervision/ui/PanelGate'

export const Route = createFileRoute('/panel/')({ component: Panel })

type Filter = 'pending' | 'approved' | 'all'

function Panel() {
  const { session, loading, configured } = useSession()
  const [filter, setFilter] = useState<Filter>('pending')

  const inspections = useQuery({
    queryKey: ['inspections', filter],
    queryFn: () => supervision.listInspections(filter),
    enabled: Boolean(session),
  })

  const gate = PanelGate({ loading, configured, session })
  if (gate || !session) return gate

  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Panel de supervisión</h1>
        <span className="text-sm text-slate-500">{session.fullName}</span>
      </header>

      <Link
        to="/panel/hallazgos"
        className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white font-medium"
      >
        Ver hallazgos de la flota →
      </Link>

      <div className="flex gap-2">
        {(['pending', 'approved', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
              filter === f ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
            }`}
          >
            {f === 'pending' ? 'Por aprobar' : f === 'approved' ? 'Aprobadas' : 'Todas'}
          </button>
        ))}
      </div>

      {inspections.isLoading && <p className="text-slate-500">Cargando…</p>}

      {inspections.isError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          No se pudo cargar. El panel necesita conexión.{' '}
          <button type="button" onClick={() => void inspections.refetch()} className="underline">
            Reintentar
          </button>
        </p>
      )}

      {inspections.data?.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {filter === 'pending' ? 'No hay inspecciones por aprobar.' : 'Sin resultados.'}
        </p>
      )}

      <ul className="space-y-2">
        {inspections.data?.map((item) => (
          <li key={item.id}>
            <Link
              to="/panel/$id"
              params={{ id: item.id }}
              className="block rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{item.plate}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    item.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.status === 'approved' ? 'Aprobada' : 'Por aprobar'}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {item.declaredByName} · {format(new Date(item.inspectedAt), 'dd/MM/yyyy HH:mm')}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-emerald-700">{item.yesCount} cumple</span>
                {' · '}
                <span className={item.noCount > 0 ? 'font-semibold text-red-700' : 'text-slate-500'}>
                  {item.noCount} no cumple
                </span>
                {' · '}
                <span className="text-slate-500">{item.naCount} N/A</span>
                {item.photoCount > 0 && (
                  <span className="text-slate-500"> · {item.photoCount} foto(s)</span>
                )}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
