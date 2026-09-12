import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'

export const Route = createRootRoute({ component: Shell })

function Shell() {
  const isHome = useRouterState({ select: (s) => s.location.pathname === '/' })

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {!isHome && (
            <Link to="/" className="text-sm text-slate-500">
              ← Inicio
            </Link>
          )}
          <span className="font-semibold">Faena Inspector</span>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  )
}
