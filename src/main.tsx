import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { bootstrap } from '@/app/container'
import './styles.css'

const router = createRouter({ routeTree })

/**
 * Server state for /panel only.
 *
 * The inspector side never uses this: there the local database is the truth and
 * there is nothing to cache or revalidate. Query lives here because the panel
 * genuinely reads from a server.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')

// Writes the bundled template locally so the app works before it has ever
// reached the server.
void bootstrap()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
