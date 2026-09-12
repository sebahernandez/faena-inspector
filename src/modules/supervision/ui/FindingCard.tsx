import { useState } from 'react'
import { format } from 'date-fns'
import { closureBlock, urgencyOf, type FleetFinding } from '../domain/finding'
import type { Session } from '@/modules/auth/domain/session'

const BADGE: Record<string, { label: string; className: string }> = {
  overdue: { label: 'Vencido', className: 'bg-red-100 text-red-800' },
  'due-soon': { label: 'Por vencer', className: 'bg-amber-100 text-amber-900' },
  undated: { label: 'Sin plazo', className: 'bg-violet-100 text-violet-900' },
  scheduled: { label: 'Programado', className: 'bg-slate-100 text-slate-700' },
  closed: { label: 'Cerrado', className: 'bg-emerald-100 text-emerald-800' },
}

interface Props {
  finding: FleetFinding
  session: Session | null
  onClose: (note: string) => Promise<void>
}

export function FindingCard({ finding, session, onClose }: Props) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urgency = urgencyOf(finding)
  const badge = BADGE[urgency]!
  const block = closureBlock(session, finding)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await onClose(note.trim())
      setOpen(false)
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cerrar el hallazgo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">
          <span className="font-mono text-slate-400">{finding.itemCode}</span> {finding.itemLabel}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <p className="mt-1 text-slate-500">
        {finding.plate} · {format(new Date(finding.inspectedAt), 'dd/MM/yyyy')}
      </p>

      {finding.observation && <p className="mt-2 text-slate-700">{finding.observation}</p>}

      <p className="mt-2 text-slate-500">
        Responsable: {finding.responsible ?? '—'} · Vence: {finding.dueDate ?? '—'}
      </p>

      {finding.closed ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          Cerrado por <strong>{finding.closedByName}</strong>
          {finding.closedAt && ` el ${format(new Date(finding.closedAt), 'dd/MM/yyyy')}`}
          {finding.closureNote && <>: {finding.closureNote}</>}
        </p>
      ) : block === 'not-a-supervisor' || block === 'not-signed-in' ? null : open ? (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">
              ¿Qué se corrigió? Queda registrado y no se puede editar.
            </span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
              placeholder="Neumático reemplazado, guía 4471"
            />
          </label>

          {error && <p className="text-red-700">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || note.trim().length < 3}
              onClick={() => void submit()}
              className="min-h-10 rounded-lg bg-slate-900 px-4 font-medium text-white disabled:opacity-40"
            >
              {busy ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="min-h-10 rounded-lg border border-slate-300 px-4 font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 min-h-10 rounded-lg border border-slate-300 px-3 font-medium"
        >
          Cerrar hallazgo
        </button>
      )}
    </li>
  )
}
