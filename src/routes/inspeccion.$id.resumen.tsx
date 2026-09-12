import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { actions } from '@/app/container'
import { tally } from '@/modules/inspection/domain/inspection'
import { findItem } from '@/modules/template/domain/template'
import { useInspection } from '@/modules/inspection/ui/hooks/use-inspection'
import { usePatchBuffer } from '@/modules/inspection/ui/hooks/use-patch-buffer'

export const Route = createFileRoute('/inspeccion/$id/resumen')({ component: Summary })

function Summary() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { loading, inspection, template, answers, overall } = useInspection(id)
  const [observations, setObservations] = useState<string | null>(null)

  const observationBuffer = usePatchBuffer<{ text: string }>((_key, patch) => {
    void actions.updateHeader(id, { generalObservations: patch.text === '' ? null : patch.text })
  })

  if (loading) return <p className="text-slate-500">Cargando…</p>
  if (!inspection || !template) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        No se encontró la inspección.
      </p>
    )
  }

  const counts = tally(answers)
  const findings = answers.filter((a) => a.value === 'NO')
  const complete = overall.answered === overall.total

  const discard = async () => {
    if (!confirm('¿Descartar este borrador? No se puede deshacer.')) return
    await actions.discardDraft(id)
    await navigate({ to: '/' })
  }

  return (
    <section className="space-y-6 pb-24">
      <header>
        <h1 className="text-xl font-semibold">Resumen</h1>
        <p className="text-sm text-slate-500">
          {inspection.plate} · {inspection.driverName ?? 'Sin conductor'}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <dt className="text-sm text-emerald-800">Cumple</dt>
          <dd className="text-2xl font-semibold text-emerald-900">{counts.yes}</dd>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <dt className="text-sm text-red-800">No cumple</dt>
          <dd className="text-2xl font-semibold text-red-900">{counts.no}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <dt className="text-sm text-slate-600">No aplica</dt>
          <dd className="text-2xl font-semibold text-slate-800">{counts.na}</dd>
        </div>
      </dl>

      {!complete && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Faltan <strong>{overall.total - overall.answered}</strong> ítems por responder.
        </p>
      )}

      <div>
        <h2 className="mb-2 text-base font-semibold">Hallazgos ({findings.length})</h2>
        {findings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
            Sin hallazgos.
          </p>
        ) : (
          <ul className="space-y-2">
            {findings.map((finding) => {
              const item = findItem(template, finding.itemId)
              return (
                <li
                  key={finding.itemId}
                  className="rounded-xl border border-red-200 bg-white p-4 text-sm"
                >
                  <p className="font-medium text-slate-900">
                    <span className="font-mono text-slate-400">{item?.code}</span> {item?.label}
                  </p>
                  {finding.observation && <p className="mt-1 text-slate-600">{finding.observation}</p>}
                  <p className="mt-2 text-slate-500">
                    Responsable: {finding.responsible ?? '—'} · Vence: {finding.dueDate ?? '—'}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Observaciones generales</span>
        <textarea
          rows={3}
          value={observations ?? inspection.generalObservations ?? ''}
          onChange={(e) => {
            setObservations(e.target.value)
            observationBuffer.push('general', { text: e.target.value })
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
        />
      </label>

      <div className="flex gap-3">
        <Link
          to="/inspeccion/$id"
          params={{ id }}
          search={{ seccion: 1 }}
          className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-slate-300 font-medium"
        >
          Volver al checklist
        </Link>
        <button
          type="button"
          onClick={() => void discard()}
          className="min-h-12 rounded-lg border border-red-300 px-4 font-medium text-red-700"
        >
          Descartar
        </button>
      </div>

      <p className="text-center text-sm text-slate-400">Firma y PDF — fase 3.</p>
    </section>
  )
}
