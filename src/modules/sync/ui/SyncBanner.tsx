import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { queries, sync } from '@/app/container'
import { useSession } from '@/modules/auth/ui/use-session'

/**
 * The inspector must *know* when signed work has not reached the server.
 *
 * Silence here would be the worst outcome: they would assume everything is in,
 * and nobody would notice a phone that has been failing to upload for a week.
 */
export function SyncBanner() {
  const pending = useLiveQuery(queries.outboxPending, [], 0)
  const parked = useLiveQuery(queries.outboxParked, [], 0)
  const { session, configured } = useSession()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(
    () =>
      sync.subscribe((r) => {
        if (r.uploaded > 0) setNote(`${r.uploaded} ${r.uploaded === 1 ? 'enviada' : 'enviadas'}.`)
        else if (r.skipped === 'signed-out') setNote(null)
      }),
    [],
  )

  if (!configured || (pending === 0 && parked === 0)) return null

  const run = async () => {
    setBusy(true)
    setNote(null)
    const r = await sync.syncNow()
    setBusy(false)
    if (r === 'busy') return
    if (r.skipped === 'signed-out') setNote('Inicia sesión para enviar.')
    else if (r.uploaded === 0 && r.rescheduled > 0) setNote('Sin conexión. Se reintentará solo.')
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {pending > 0 && (
        <p>
          <strong>{pending}</strong>{' '}
          {pending === 1 ? 'inspección firmada sin enviar' : 'inspecciones firmadas sin enviar'}.
          {session ? ' Se subirán solas cuando haya señal.' : ' Inicia sesión para enviarlas.'}
        </p>
      )}

      {parked > 0 && (
        <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
          <strong>{parked}</strong> {parked === 1 ? 'quedó detenida' : 'quedaron detenidas'} y
          {parked === 1 ? ' necesita' : ' necesitan'} revisión. Avisa al supervisor.
        </p>
      )}

      {note && <p className="text-amber-800">{note}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="min-h-10 rounded-lg border border-amber-400 bg-white px-3 font-medium disabled:opacity-50"
      >
        {busy ? 'Enviando…' : 'Enviar ahora'}
      </button>
    </div>
  )
}
