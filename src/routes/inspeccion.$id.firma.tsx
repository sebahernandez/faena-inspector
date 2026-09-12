import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useCallback, useRef, useState } from 'react'
import { actions } from '@/app/container'
import { SignaturePad } from '@/modules/inspection/ui/components/SignaturePad'
import { useInspection } from '@/modules/inspection/ui/hooks/use-inspection'

export const Route = createFileRoute('/inspeccion/$id/firma')({ component: Sign })

type PadApi = { toBlob: () => Promise<Blob | null>; clear: () => void }

function Sign() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const { loading, inspection, overall } = useInspection(id)

  const padRef = useRef<PadApi | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReady = useCallback((api: PadApi) => {
    padRef.current = api
  }, [])
  const handleChange = useCallback((isEmpty: boolean) => setHasSignature(!isEmpty), [])

  if (loading) return <p className="text-slate-500">Cargando…</p>
  if (!inspection) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        No se encontró la inspección.
      </p>
    )
  }

  const complete = overall.answered === overall.total
  const canSubmit = complete && hasSignature && name.trim().length > 1 && !busy

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const signature = await padRef.current?.toBlob()
      if (!signature) throw new Error('La firma quedó vacía.')

      await actions.submitInspection(
        id,
        signature,
        { name: name.trim(), role: role.trim() === '' ? null : role.trim() },
        overall.total,
      )
      await navigate({ to: '/inspeccion/$id/documento', params: { id } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo firmar la inspección.')
      setBusy(false)
    }
  }

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base'

  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold">Declarado por</h1>
        <p className="text-sm text-slate-500">
          {inspection.plate} · una vez firmada, la inspección no se puede editar.
        </p>
      </header>

      {!complete && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Faltan <strong>{overall.total - overall.answered}</strong> ítems por responder. Complétalos
          antes de firmar.
        </p>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Nombre</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Cargo</span>
        <input value={role} onChange={(e) => setRole(e.target.value)} className={field} />
      </label>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">Firma</span>
        <SignaturePad onChange={handleChange} onReady={handleReady} />
      </div>

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="min-h-12 w-full rounded-lg bg-slate-900 font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Firmando…' : 'Firmar y cerrar inspección'}
      </button>
    </section>
  )
}
