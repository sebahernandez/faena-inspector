import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * The anon key is public by design — what protects the data is row level
 * security, not the key. See supabase/migrations.
 *
 * Null when the project is not configured. That is a supported state: the
 * inspector side is fully usable without a backend, it simply never syncs.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null

export const isSupabaseConfigured = (): boolean => supabase !== null
