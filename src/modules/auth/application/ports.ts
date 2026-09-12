import type { Session } from '../domain/session'

export class AuthUnavailableError extends Error {
  constructor() {
    super('Sync is not configured on this device')
    this.name = 'AuthUnavailableError'
  }
}

export interface AuthGateway {
  /** False when the backend is not configured — the app still works offline. */
  isConfigured(): boolean
  signIn(email: string, password: string): Promise<Session>
  signOut(): Promise<void>
  currentSession(): Promise<Session | null>
  onChange(listener: (session: Session | null) => void): () => void
}
