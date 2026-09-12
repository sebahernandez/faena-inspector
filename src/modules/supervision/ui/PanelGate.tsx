import { Link } from '@tanstack/react-router'
import type { Session } from '@/modules/auth/domain/session'

/**
 * Says plainly why the panel cannot be used, instead of showing an empty list.
 *
 * An empty screen reads as "there is nothing to approve" — the opposite of the
 * truth when the real reason is that nobody is signed in.
 *
 * Returns null when the panel may proceed.
 */
export function PanelGate({
  loading,
  configured,
  session,
}: {
  loading: boolean
  configured: boolean
  session: Session | null
}) {
  if (loading) return <p className="text-slate-500">Cargando…</p>

  if (!configured) {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Panel no disponible</h1>
        <p className="text-slate-600">
          Esta instalación funciona solo en el teléfono. El panel de supervisión necesita un
          servidor configurado.
        </p>
      </section>
    )
  }

  if (!session) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Inicia sesión</h1>
        <p className="text-slate-600">El panel de supervisión requiere una sesión iniciada.</p>
        <Link
          to="/acceso"
          className="inline-flex min-h-12 items-center rounded-lg bg-slate-900 px-4 font-semibold text-white"
        >
          Ir a acceso
        </Link>
      </section>
    )
  }

  if (session.role !== 'supervisor' && session.role !== 'admin') {
    return (
      <section className="space-y-2">
        <h1 className="text-xl font-semibold">Sin permisos</h1>
        <p className="text-slate-600">
          Tu cuenta tiene el rol <strong>{session.role}</strong>. Aprobar inspecciones requiere el
          rol de supervisor.
        </p>
      </section>
    )
  }

  return null
}
