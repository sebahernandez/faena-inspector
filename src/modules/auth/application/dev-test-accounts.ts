export interface DevTestAccount {
  label: string
  email: string
  password: string
}

type DevEnv = Readonly<Record<string, string | undefined>>

/**
 * Pre-filled login accounts for development. Pure: the caller passes the env
 * and the dev flag, so a production build gets an empty list.
 */
export function devTestAccounts(env: DevEnv, isDev: boolean): DevTestAccount[] {
  if (!isDev) return []
  const password = env['VITE_TEST_PASSWORD']?.trim()
  if (!password) return []

  const candidates = [
    { label: 'Inspector', email: env['VITE_TEST_INSPECTOR_EMAIL']?.trim() },
    { label: 'Supervisor', email: env['VITE_TEST_SUPERVISOR_EMAIL']?.trim() },
  ]
  return candidates.flatMap(({ label, email }) => (email ? [{ label, email, password }] : []))
}
