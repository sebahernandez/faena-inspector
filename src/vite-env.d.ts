/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev-only pre-filled login accounts. Never set these in a production build. */
  readonly VITE_TEST_INSPECTOR_EMAIL?: string
  readonly VITE_TEST_SUPERVISOR_EMAIL?: string
  readonly VITE_TEST_PASSWORD?: string
}
