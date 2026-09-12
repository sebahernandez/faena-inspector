import { useEffect, useState } from 'react'
import { actions, queries } from '@/app/container'
import { MAX_PHOTOS_PER_FINDING, remainingSlots } from '../../domain/evidence'
import type { EvidencePhoto } from '../../domain/evidence'

interface Props {
  inspectionId: string
  itemId: string
  photos: EvidencePhoto[]
  disabled?: boolean
  onChanged: () => void
}

export function EvidencePhotos({ inspectionId, itemId, photos, disabled, onChanged }: Props) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Object URLs must be revoked or every re-render leaks a few hundred KB.
  useEffect(() => {
    let alive = true
    const created: string[] = []

    void (async () => {
      const next: Record<string, string> = {}
      for (const photo of photos) {
        const blob = await queries.photoImage(photo.id)
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        created.push(url)
        next[photo.id] = url
      }
      if (alive) setUrls(next)
      else created.forEach((u) => URL.revokeObjectURL(u))
    })()

    return () => {
      alive = false
      created.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [photos])

  const add = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      await actions.attachEvidence(inspectionId, itemId, file)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo adjuntar la foto.')
    } finally {
      setBusy(false)
    }
  }

  const left = remainingSlots(photos.length)

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <figure key={photo.id} className="relative">
            {urls[photo.id] ? (
              <img
                src={urls[photo.id]}
                alt="Evidencia"
                className="h-20 w-20 rounded-lg border border-slate-300 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-[10px] text-slate-400">
                enviada
              </div>
            )}
            {!disabled && photo.storagePath === null && (
              <button
                type="button"
                aria-label="Quitar foto"
                onClick={() => void actions.removeEvidence(photo.id, inspectionId).then(onChanged)}
                className="absolute -right-1.5 -top-1.5 h-6 w-6 rounded-full bg-slate-900 text-xs text-white"
              >
                ×
              </button>
            )}
          </figure>
        ))}

        {!disabled && left > 0 && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-xs text-slate-500">
            {busy ? '…' : '+ Foto'}
            <input
              type="file"
              accept="image/*"
              // `capture` opens the camera straight away instead of the gallery.
              capture="environment"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void add(file)
              }}
            />
          </label>
        )}
      </div>

      <p className="text-xs text-slate-500">
        {left > 0
          ? `Hasta ${MAX_PHOTOS_PER_FINDING} fotos por ítem · quedan ${left}`
          : `Máximo de ${MAX_PHOTOS_PER_FINDING} fotos alcanzado`}
      </p>

      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  )
}
