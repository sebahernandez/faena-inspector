import { useEffect, useState } from 'react'
import { auth } from '@/app/container'
import type { Session } from '../domain/session'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void auth.currentSession().then((s) => {
      if (!alive) return
      setSession(s)
      setLoading(false)
    })
    const stop = auth.onChange((s) => alive && setSession(s))
    return () => {
      alive = false
      stop()
    }
  }, [])

  return { session, loading, configured: auth.isConfigured() }
}
