import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { auth } from '@/app/container'
import { devTestAccounts } from '@/modules/auth/application/dev-test-accounts'
import { useSession } from '@/modules/auth/ui/use-session'

export const Route = createFileRoute('/acceso')({ component: Access })

function Access() {
  const { session, loading, configured } = useSession()
  const [testAccounts] = useState(() => devTestAccounts(import.meta.env, import.meta.env.DEV))
  const [email, setEmail] = useState(testAccounts[0]?.email ?? '')
  const [password, setPassword] = useState(testAccounts[0]?.password ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className="text-slate-500">Cargando…</p>

  if (!configured) {
    return (
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Sincronización no configurada</h1>
        <p className="text-slate-600">
          Esta instalación funciona solo en el teléfono. Las inspecciones se guardan y se firman
          igual, y el PDF se genera igual — pero no se suben a ningún servidor.
        </p>
      </section>
    )
  }

  if (session) {
    return (
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">{session.fullName}</h1>
        <dl className="space-y-1 text-sm text-slate-600">
          <div>{session.email}</div>
          <div>
            {session.jobTitle ?? 'Sin cargo'} · {session.role}
          </div>
        </dl>
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="min-h-12 w-full rounded-lg border border-slate-300 font-medium"
        >
          Cerrar sesión
        </button>
      </section>
    )
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await auth.signIn(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.')
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base'

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">Acceso</h1>
      <p className="text-sm text-slate-500">
        Solo hace falta para sincronizar. La inspección funciona sin sesión.
      </p>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Correo</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={field}
        />
      </label>

      {testAccounts.length > 0 && (
        <div className="space-y-2">
          <span className="block text-sm font-medium text-slate-700">Cuentas de prueba</span>
          <div className="flex gap-2">
            {testAccounts.map((account) => (
              <button
                key={account.label}
                type="button"
                onClick={() => {
                  setEmail(account.email)
                  setPassword(account.password)
                }}
                className="min-h-12 flex-1 rounded-lg border border-slate-300 font-medium"
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      )}

      <button
        type="button"
        disabled={busy || email === '' || password === ''}
        onClick={() => void submit()}
        className="min-h-12 w-full rounded-lg bg-slate-900 font-semibold text-white disabled:opacity-40"
      >
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </section>
  )
}
