import type { Session } from '../domain/session'
import { sessionSchema } from '../domain/session'
import { AuthUnavailableError, type AuthGateway } from '../application/ports'
import { supabase } from './supabase-client'

interface ProfileRow {
  org_id: string
  full_name: string
  job_title: string | null
  role: Session['role']
}

export function createSupabaseAuthGateway(): AuthGateway {
  const loadSession = async (): Promise<Session | null> => {
    if (!supabase) return null
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user?.email) return null

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('org_id, full_name, job_title, role')
      .eq('id', user.id)
      .single<ProfileRow>()

    // A signed-in user with no profile row cannot act: RLS would hide
    // everything anyway, so surface it as "not signed in" rather than a
    // half-working session.
    if (error || !profile) return null

    return sessionSchema.parse({
      userId: user.id,
      email: user.email,
      orgId: profile.org_id,
      fullName: profile.full_name,
      jobTitle: profile.job_title,
      role: profile.role,
    })
  }

  return {
    isConfigured: () => supabase !== null,

    async signIn(email, password) {
      if (!supabase) throw new AuthUnavailableError()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)

      const session = await loadSession()
      if (!session) throw new Error('Tu usuario no tiene un perfil asignado.')
      return session
    },

    async signOut() {
      await supabase?.auth.signOut()
    },

    currentSession: loadSession,

    onChange(listener) {
      if (!supabase) return () => {}
      const { data } = supabase.auth.onAuthStateChange(() => {
        void loadSession().then(listener)
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
