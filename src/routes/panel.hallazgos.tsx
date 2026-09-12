import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supervision } from '@/app/container'
import { useSession } from '@/modules/auth/ui/use-session'
import { PanelGate } from '@/modules/supervision/ui/PanelGate'
import { FindingCard } from '@/modules/supervision/ui/FindingCard'
import { groupByResponsible, tallyFindings } from '@/modules/supervision/domain/finding'

export const Route = createFileRoute('/panel/hallazgos')({ component: Findings })

type Filter = 'open' | 'overdue' | 'closed' | 'all'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Abiertos' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'closed', label: 'Cerrados' },
  { value: 'all', label: 'Todos' },
]

function Findings() {
  const { session, loading, configured } = useSession()
  const [filter, setFilter] = useState<Filter>('open')
  const queryClient = useQueryClient()

  const findings = useQuery({
    queryKey: ['findings', filter],
    queryFn: () => supervision.listFindings(filter),
    enabled: Boolean(session),
  })

  const close = useMutation({
    mutationFn: ({ inspectionId, itemId, note }: { inspectionId: string; itemId: string; note: string }) =>
      supervision.closeFinding(inspectionId, itemId, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['findings'] }),
  })

  const gate = PanelGate({ loading, configured, session })
  if (gate || !session) return gate

  const data = findings.data ?? []
  const tally = tallyFindings(data)
  const groups = groupByResponsible(data)

  return (
    <section className="space-y-5 pb-8">
      <header className="flex items-baseline justify-between">
        <div>
          <Link to="/panel" className="text-sm text-slate-500">
            ← Panel
          </Link>
          <h1 className="text-xl font-semibold">Hallazgos de la flota</h1>
        </div>
        <span className="text-sm text-slate-500">{session.fullName}</span>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <dt className="text-sm text-red-800">Vencidos</dt>
          <dd className="text-xl font-semibold text-red-900">{tally.overdue}</dd>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <dt className="text-sm text-amber-900">Abiertos</dt>
          <dd className="text-xl font-semibold text-amber-900">{tally.open}</dd>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <dt className="text-sm text-emerald-800">Cerrados</dt>
          <dd className="text-xl font-semibold text-emerald-900">{tally.closed}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${
              filter === f.value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {findings.isLoading && <p className="text-slate-500">Cargando…</p>}

      {findings.isError && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          No se pudo cargar. El panel necesita conexión.{' '}
          <button type="button" onClick={() => void findings.refetch()} className="underline">
            Reintentar
          </button>
        </p>
      )}

      {!findings.isLoading && data.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {filter === 'overdue'
            ? 'Nada vencido. Buen momento.'
            : filter === 'open'
              ? 'No hay hallazgos abiertos.'
              : 'Sin resultados.'}
        </p>
      )}

      {groups.map((group) => (
        <div key={group.responsible}>
          <h2 className="mb-2 flex items-baseline justify-between text-base font-semibold">
            <span>{group.responsible}</span>
            <span className="text-sm font-normal text-slate-500">
              {group.openCount} abierto(s)
              {group.overdueCount > 0 && (
                <span className="font-medium text-red-700"> · {group.overdueCount} vencido(s)</span>
              )}
            </span>
          </h2>

          <ul className="space-y-2">
            {group.findings.map((finding) => (
              <FindingCard
                key={`${finding.inspectionId}:${finding.itemId}`}
                finding={finding}
                session={session}
                onClose={(note) =>
                  close.mutateAsync({
                    inspectionId: finding.inspectionId,
                    itemId: finding.itemId,
                    note,
                  })
                }
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
