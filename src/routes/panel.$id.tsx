import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { format } from 'date-fns'
import { supervision } from '@/app/container'
import { useSession } from '@/modules/auth/ui/use-session'
import { PanelGate } from '@/modules/supervision/ui/PanelGate'
import { SignaturePad } from '@/modules/inspection/ui/components/SignaturePad'
import { approvalBlock, findingsOf } from '@/modules/supervision/domain/review'

export const Route = createFileRoute('/panel/$id')({ component: Review })

type PadApi = { toBlob: () => Promise<Blob | null>; clear: () => void }

const BLOCK_MESSAGE: Record<string, string> = {
  'not-signed-in': 'Inicia sesión para aprobar.',
  'not-a-supervisor': 'Tu rol no permite aprobar inspecciones.',
  'already-approved': 'Esta inspección ya fue aprobada.',
  'own-inspection':
    'No puedes aprobar una inspección que tú mismo declaraste: la segunda firma existe para que la revise otra persona.',
}

function Review() {
  const { id } = Route.useParams()
  const { session, loading, configured } = useSession()
  const queryClient = useQueryClient()

  const padRef = useRef<PadApi | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const handleReady = useCallback((api: PadApi) => {
    padRef.current = api
  }, [])
  const handleChange = useCallback((empty: boolean) => setHasSignature(!empty), [])

  const detail = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => supervision.getInspection(id),
    enabled: Boolean(session),
  })

  const approve = useMutation({
    mutationFn: async () => {
      const signature = await padRef.current?.toBlob()
      await supervision.approve(id, signature ?? null)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inspection', id] })
      await queryClient.invalidateQueries({ queryKey: ['inspections'] })
    },
  })

  const gate = PanelGate({ loading, configured, session })
  if (gate || !session) return gate

  if (detail.isLoading) return <p className="text-slate-500">Cargando…</p>
  if (detail.isError || !detail.data) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        No se pudo cargar la inspección. El panel necesita conexión.
      </p>
    )
  }

  const { summary, answers, photos, generalObservations, declaredByUserId } = detail.data
  const findings = findingsOf(answers)
  const block = approvalBlock(session, summary, declaredByUserId)
  const photosByItem = new Map<string, string[]>()
  for (const p of photos) photosByItem.set(p.itemId, [...(photosByItem.get(p.itemId) ?? []), p.url])

  return (
    <section className="space-y-6 pb-8">
      <header className="space-y-1">
        <Link to="/panel" className="text-sm text-slate-500">
          ← Panel
        </Link>
        <h1 className="text-xl font-semibold">{summary.plate}</h1>
        <p className="text-sm text-slate-500">
          {summary.declaredByName}
          {summary.declaredByRole ? ` (${summary.declaredByRole})` : ''} ·{' '}
          {format(new Date(summary.inspectedAt), 'dd/MM/yyyy HH:mm')}
          {summary.odometerKm !== null && ` · ${summary.odometerKm.toLocaleString('es-CL')} km`}
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <dt className="text-sm text-emerald-800">Cumple</dt>
          <dd className="text-xl font-semibold text-emerald-900">{summary.yesCount}</dd>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <dt className="text-sm text-red-800">No cumple</dt>
          <dd className="text-xl font-semibold text-red-900">{summary.noCount}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <dt className="text-sm text-slate-600">No aplica</dt>
          <dd className="text-xl font-semibold">{summary.naCount}</dd>
        </div>
      </dl>

      <div>
        <h2 className="mb-2 text-base font-semibold">Hallazgos ({findings.length})</h2>
        {findings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
            Sin hallazgos.
          </p>
        ) : (
          <ul className="space-y-2">
            {findings.map((f) => (
              <li key={f.itemId} className="rounded-xl border border-red-200 bg-white p-4 text-sm">
                <p className="font-medium">
                  <span className="font-mono text-slate-400">{f.itemCode}</span> {f.itemLabel}
                </p>
                {f.observation && <p className="mt-1 text-slate-600">{f.observation}</p>}
                <p className="mt-1 text-slate-500">
                  Responsable: {f.responsible ?? '—'} · Vence: {f.dueDate ?? '—'}
                </p>
                {(photosByItem.get(f.itemId) ?? []).length > 0 && (
                  <div className="mt-2 flex gap-2">
                    {photosByItem.get(f.itemId)!.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          alt="Evidencia"
                          className="h-20 w-20 rounded-lg border border-slate-300 object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {generalObservations && (
        <div>
          <h2 className="mb-1 text-base font-semibold">Observaciones generales</h2>
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            {generalObservations}
          </p>
        </div>
      )}

      {summary.status === 'approved' ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Aprobada por <strong>{summary.approvedByName}</strong>
          {summary.approvedAt && ` el ${format(new Date(summary.approvedAt), 'dd/MM/yyyy HH:mm')}`}.
        </p>
      ) : block ? (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {BLOCK_MESSAGE[block]}
        </p>
      ) : (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Aprobar</h2>
          <SignaturePad onChange={handleChange} onReady={handleReady} />

          {approve.isError && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
              {approve.error instanceof Error ? approve.error.message : 'No se pudo aprobar.'}
            </p>
          )}

          <button
            type="button"
            disabled={!hasSignature || approve.isPending}
            onClick={() => approve.mutate()}
            className="min-h-12 w-full rounded-lg bg-slate-900 font-semibold text-white disabled:opacity-40"
          >
            {approve.isPending ? 'Aprobando…' : 'Aprobar inspección'}
          </button>
        </div>
      )}
    </section>
  )
}
