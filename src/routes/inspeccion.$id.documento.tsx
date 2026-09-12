import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { actions } from '@/app/container'
import { sharePdf } from '@/shared/lib/share'
import { useInspection } from '@/modules/inspection/ui/hooks/use-inspection'
import { findItem } from '@/modules/template/domain/template'
import { tally } from '@/modules/inspection/domain/inspection'

export const Route = createFileRoute('/inspeccion/$id/documento')({ component: SignedDocument })

function SignedDocument() {
  const { id } = Route.useParams()
  const { loading, inspection, template, answers } = useInspection(id)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  /**
   * The PDF is produced the moment the inspection is signed, without waiting
   * for the inspector to ask. That is the mitigation that makes the whole
   * design safe: the document leaves the browser immediately, so an evicted
   * local database can no longer destroy a signed record.
   */
  useEffect(() => {
    if (!inspection || inspection.status === 'draft') return
    let cancelled = false

    void (async () => {
      setBusy(true)
      try {
        const { blob, fileName } = await actions.exportPdf(id)
        if (cancelled) return
        const outcome = await sharePdf(blob, fileName)
        setStatus(outcome === 'shared' ? 'PDF compartido.' : `PDF descargado: ${fileName}`)
      } catch {
        if (!cancelled) setStatus('No se pudo generar el PDF automáticamente. Usa el botón.')
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, inspection?.status])

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

  const share = async () => {
    setBusy(true)
    setStatus(null)
    try {
      const { blob, fileName } = await actions.exportPdf(id)
      const outcome = await sharePdf(blob, fileName)
      setStatus(outcome === 'shared' ? 'PDF compartido.' : `PDF descargado: ${fileName}`)
    } catch {
      setStatus('No se pudo generar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5">
      <header className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h1 className="font-semibold text-emerald-900">Inspección firmada</h1>
        <p className="text-sm text-emerald-800">
          {inspection.plate} · {inspection.declaredByName}
          {inspection.declaredByRole ? ` (${inspection.declaredByRole})` : ''}
        </p>
        <p className="mt-1 text-sm text-emerald-700">
          Queda pendiente de envío. Se subirá sola cuando haya señal.
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <dt className="text-sm text-slate-500">Cumple</dt>
          <dd className="text-xl font-semibold">{counts.yes}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <dt className="text-sm text-slate-500">No cumple</dt>
          <dd className="text-xl font-semibold text-red-700">{counts.no}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <dt className="text-sm text-slate-500">No aplica</dt>
          <dd className="text-xl font-semibold">{counts.na}</dd>
        </div>
      </dl>

      <button
        type="button"
        disabled={busy}
        onClick={() => void share()}
        className="min-h-12 w-full rounded-lg bg-slate-900 font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Generando PDF…' : 'Compartir PDF'}
      </button>

      {status && <p className="text-center text-sm text-slate-600">{status}</p>}

      {findings.length > 0 && (
        <div>
          <h2 className="mb-2 text-base font-semibold">Hallazgos ({findings.length})</h2>
          <ul className="space-y-2">
            {findings.map((finding) => {
              const item = findItem(template, finding.itemId)
              return (
                <li key={finding.itemId} className="rounded-xl border border-red-200 bg-white p-3 text-sm">
                  <p className="font-medium">
                    <span className="font-mono text-slate-400">{item?.code}</span> {item?.label}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {finding.responsible ?? '—'} · vence {finding.dueDate ?? '—'}
                  </p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Link
        to="/"
        className="flex min-h-12 items-center justify-center rounded-lg border border-slate-300 font-medium"
      >
        Volver al inicio
      </Link>
    </section>
  )
}
