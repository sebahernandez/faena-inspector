import { describe, expect, it } from 'vitest'
import { devTestAccounts } from './dev-test-accounts'

const env = {
  VITE_TEST_INSPECTOR_EMAIL: 'inspector@example.test',
  VITE_TEST_SUPERVISOR_EMAIL: 'supervisor@example.test',
  VITE_TEST_PASSWORD: 'fake-password',
}

describe('devTestAccounts', () => {
  it('returns nothing outside dev', () => {
    expect(devTestAccounts(env, false)).toEqual([])
  })

  it('returns inspector then supervisor in dev', () => {
    expect(devTestAccounts(env, true)).toEqual([
      { label: 'Inspector', email: 'inspector@example.test', password: 'fake-password' },
      { label: 'Supervisor', email: 'supervisor@example.test', password: 'fake-password' },
    ])
  })

  it('drops only the account whose email is missing or blank', () => {
    const { VITE_TEST_SUPERVISOR_EMAIL: _omit, ...withoutSupervisor } = env
    expect(devTestAccounts(withoutSupervisor, true).map((a) => a.label)).toEqual(['Inspector'])
    expect(
      devTestAccounts({ ...env, VITE_TEST_INSPECTOR_EMAIL: '   ' }, true).map((a) => a.label),
    ).toEqual(['Supervisor'])
  })

  it('returns nothing when the password is missing or blank', () => {
    expect(devTestAccounts({ ...env, VITE_TEST_PASSWORD: undefined }, true)).toEqual([])
    expect(devTestAccounts({ ...env, VITE_TEST_PASSWORD: ' ' }, true)).toEqual([])
  })
})
