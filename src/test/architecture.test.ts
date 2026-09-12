/**
 * The architecture rule, as a test.
 *
 * oxlint has no `no-restricted-paths` / `no-restricted-imports`, so
 * eslint-plugin-boundaries is not an option here. This is better anyway: it is
 * precise about our layers and it fails the same suite as everything else.
 *
 *     ui  ->  application  ->  domain
 *                  ^
 *            infrastructure
 *
 * Everyone draws a nice architecture in a document. Then, week three, with the
 * client pushing, somebody imports the database into the domain "just this
 * once". A rule that cannot be violated beats ten pages of conventions.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(process.cwd(), 'src')

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return walk(full)
    if (/\.(test|spec)\.tsx?$/.test(full)) return [] // tests may import anything
    return /\.tsx?$/.test(full) ? [full] : []
  })

const importsOf = (file: string): string[] => {
  const source = readFileSync(file, 'utf8')
  const specifiers: string[] = []
  const pattern = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    if (match[1]) specifiers.push(match[1])
  }
  return specifiers
}

const files = walk(SRC).map((file) => ({
  path: relative(SRC, file),
  imports: importsOf(file),
}))

const inLayer = (path: string, layer: string) =>
  path.includes(`/${layer}/`) || path.startsWith(`${layer}/`)

/**
 * The composition root is the ONE place allowed to know about implementations.
 * That is its whole job: it wires ports to adapters so nothing else has to.
 */
const isCompositionRoot = (path: string) => path.startsWith('app/')

describe('dependency rules', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('the domain imports nothing but zod and itself', () => {
    const offenders = files
      .filter((f) => inLayer(f.path, 'domain'))
      .flatMap((f) =>
        f.imports
          .filter((spec) => spec !== 'zod')
          .filter((spec) => spec.startsWith('@/') || spec.startsWith('.') === false)
          .filter((spec) => !spec.startsWith('./') && !spec.startsWith('../domain'))
          .map((spec) => `${f.path} -> ${spec}`),
      )

    expect(offenders, 'domain must stay an island: no React, no Dexie, no Supabase').toEqual([])
  })

  it('the application layer never touches infrastructure', () => {
    const offenders = files
      .filter((f) => inLayer(f.path, 'application'))
      .flatMap((f) =>
        f.imports
          .filter((spec) => spec.includes('infrastructure') || spec.includes('shared/db'))
          .map((spec) => `${f.path} -> ${spec}`),
      )

    expect(offenders, 'use cases depend on ports, never on implementations').toEqual([])
  })

  it('the UI never imports infrastructure or the database directly', () => {
    const offenders = files
      .filter((f) => inLayer(f.path, 'ui') || inLayer(f.path, 'routes'))
      .filter((f) => !isCompositionRoot(f.path))
      .flatMap((f) =>
        f.imports
          .filter((spec) => spec.includes('/infrastructure/') || spec.includes('shared/db/db'))
          .map((spec) => `${f.path} -> ${spec}`),
      )

    expect(offenders, 'the UI reaches data through a use case, never through infrastructure').toEqual([])
  })

  it('no domain or application code performs a network call', () => {
    /**
     * Submitting is a LOCAL fact; the upload is the sync worker's job, later.
     *
     * This checks what the code DOES, not what it mentions. An earlier version
     * grepped for the word "supabase" and flagged a prose comment — a rule that
     * cries wolf is a rule people start ignoring.
     */
    const NETWORK_CALLS = /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew WebSocket\b|sendBeacon\s*\(|\bEventSource\b/
    const NETWORK_CLIENTS = /^(@supabase\/|axios$|ky$|got$|superagent$)/

    const offenders = files
      .filter((f) => inLayer(f.path, 'domain') || inLayer(f.path, 'application'))
      .flatMap((f) => {
        const reasons: string[] = []
        const source = readFileSync(join(SRC, f.path), 'utf8')
        if (NETWORK_CALLS.test(source)) reasons.push(`${f.path}: makes a network call`)
        for (const spec of f.imports) {
          if (NETWORK_CLIENTS.test(spec)) reasons.push(`${f.path}: imports ${spec}`)
        }
        return reasons
      })

    expect(offenders, 'no network in domain or application — that would break offline-first').toEqual([])
  })

  it('the rule above actually catches a violation', () => {
    // A guard for the guard: a typo in the regex would silently pass forever.
    const NETWORK_CALLS = /\bfetch\s*\(|\bXMLHttpRequest\b|\bnew WebSocket\b|sendBeacon\s*\(|\bEventSource\b/
    expect(NETWORK_CALLS.test('await fetch(url)')).toBe(true)
    expect(NETWORK_CALLS.test('new WebSocket(url)')).toBe(true)
    expect(NETWORK_CALLS.test('navigator.sendBeacon(url)')).toBe(true)
    expect(NETWORK_CALLS.test('// we deliberately do not talk to supabase here')).toBe(false)

    const NETWORK_CLIENTS = /^(@supabase\/|axios$|ky$|got$|superagent$)/
    expect(NETWORK_CLIENTS.test('@supabase/supabase-js')).toBe(true)
    expect(NETWORK_CLIENTS.test('./supabase-payload')).toBe(false)
  })
})
