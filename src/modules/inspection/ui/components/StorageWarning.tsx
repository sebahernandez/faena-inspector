import { useEffect, useState } from 'react'
import { storagePressure, type StoragePressure } from '../../domain/evidence'

/**
 * Warns before the browser starts evicting.
 *
 * When a phone runs out of quota the browser does not ask — it deletes. Here
 * that means deleting a signed inspection that has not been uploaded. The
 * inspector needs to hear about it while there is still time to sync.
 */
export function StorageWarning() {
  const [pressure, setPressure] = useState<StoragePressure>('ok')

  useEffect(() => {
    let alive = true
    void (async () => {
      if (!navigator.storage?.estimate) return
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate()
        if (alive) setPressure(storagePressure(usage, quota))
      } catch {
        // Some browsers refuse to answer. Silence is fine; this is an extra.
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (pressure === 'ok') return null

  const critical = pressure === 'critical'

  return (
    <p
      className={`rounded-lg border px-4 py-3 text-sm ${
        critical
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}
    >
      {critical ? (
        <>
          <strong>Almacenamiento casi lleno.</strong> Sincroniza cuanto antes: el navegador puede
          borrar inspecciones que no se hayan enviado.
        </>
      ) : (
        <>El almacenamiento del teléfono se está llenando. Conviene sincronizar pronto.</>
      )}
    </p>
  )
}
