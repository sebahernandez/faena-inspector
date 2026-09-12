import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useReducer } from 'react'
import { z } from 'zod'
import { useInspection } from '@/modules/inspection/ui/hooks/use-inspection'
import { usePatchBuffer } from '@/modules/inspection/ui/hooks/use-patch-buffer'
import { ItemRow } from '@/modules/inspection/ui/components/ItemRow'
import { ProgressBar } from '@/modules/inspection/ui/components/ProgressBar'
import { StorageWarning } from '@/modules/inspection/ui/components/StorageWarning'
import { useLiveQuery } from 'dexie-react-hooks'
import { queries } from '@/app/container'

/** Validated search params — this is what TanStack Router buys over React Router. */
const searchSchema = z.object({ seccion: z.coerce.number().int().min(1).default(1) })

export const Route = createFileRoute('/inspeccion/$id/')({
  validateSearch: searchSchema,
  component: Checklist,
})

function Checklist() {
  const { id } = Route.useParams()
  const { seccion } = Route.useSearch()
  const navigate = useNavigate()
  const { loading, inspection, template, answerByItem, progress, overall, answer, updateFinding } =
    useInspection(id)

  // useLiveQuery re-runs on every photos write, so the thumbnails refresh
  // themselves — `onPhotosChanged` exists only for the browsers where the
  // observer misses a same-tick write.
  const photos = useLiveQuery(() => queries.photosOfInspection(id), [id], [])
  const [photoNonce, bumpPhotos] = useReducer((n: number) => n + 1, 0)
  void photoNonce

  // A tap writes immediately — that is the data we cannot afford to lose.
  // Free text waits a beat, but patches MERGE per item so moving between
  // fields never cancels what was already typed.
  const findings = usePatchBuffer<{ observation?: string; responsible?: string; dueDate?: string }>(
    (itemId, patch) => void updateFinding(itemId, patch),
  )

  if (loading) return <p className="text-slate-500">Cargando…</p>
  if (!inspection || !template) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        No se encontró la inspección.
      </p>
    )
  }

  const index = Math.min(seccion, template.sections.length) - 1
  const current = progress[index]
  if (!current) return <p className="text-slate-500">Sección no encontrada.</p>

  const isLast = index === template.sections.length - 1
  const goTo = (n: number) => navigate({ to: '.', search: { seccion: n } })

  return (
    <section className="space-y-5 pb-24">
      <header className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">{inspection.plate}</h1>
          <span className="text-sm text-slate-500">
            Sección {current.section.code} de {template.sections.length}
          </span>
        </div>
        <ProgressBar answered={overall.answered} total={overall.total} />
      </header>

      <StorageWarning />

      {/* Section jump: the inspector walks around the truck, not down a list. */}
      <nav className="flex gap-2 overflow-x-auto pb-1">
        {progress.map((p, i) => (
          <button
            key={p.section.id}
            type="button"
            onClick={() => { findings.flush(); void goTo(i + 1) }}
            className={`min-h-10 shrink-0 rounded-lg border px-3 text-sm font-medium ${
              i === index
                ? 'border-slate-900 bg-slate-900 text-white'
                : p.complete
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-600'
            }`}
          >
            {p.section.code} · {p.answered}/{p.total}
          </button>
        ))}
      </nav>

      <h2 className="text-base font-semibold text-slate-800">{current.section.title}</h2>

      <ul className="space-y-3">
        {current.section.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            inspectionId={id}
            answer={answerByItem.get(item.id)}
            photos={photos.filter((p) => p.itemId === item.id)}
            onAnswer={(value) => void answer(item.id, value)}
            onFindingChange={(patch) => findings.push(item.id, patch)}
            onPhotosChanged={bumpPhotos}
          />
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => { findings.flush(); void goTo(index) }}
            className="min-h-12 flex-1 rounded-lg border border-slate-300 font-medium disabled:opacity-40"
          >
            Anterior
          </button>
          {isLast ? (
            <Link
              onClick={() => findings.flush()}
              to="/inspeccion/$id/resumen"
              params={{ id }}
              className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-slate-900 font-semibold text-white"
            >
              Ver resumen
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => { findings.flush(); void goTo(index + 2) }}
              className="min-h-12 flex-1 rounded-lg bg-slate-900 font-semibold text-white"
            >
              Siguiente
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
