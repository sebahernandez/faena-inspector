import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePatchBuffer } from './use-patch-buffer'

type Patch = { observation?: string; responsible?: string; dueDate?: string }

let api: ReturnType<typeof usePatchBuffer<Patch>>
const writes: [string, Patch][] = []

function Probe() {
  api = usePatchBuffer<Patch>((key, patch) => {
    writes.push([key, patch])
  })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  writes.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

describe('usePatchBuffer', () => {
  it('merges consecutive edits to the same key instead of replacing them', () => {
    const view = render(<Probe />)

    act(() => {
      api.push('item-1-1', { observation: 'Neumático liso' })
      api.push('item-1-1', { responsible: 'M. Rojas' })
      api.push('item-1-1', { dueDate: '2026-04-15' })
    })
    act(() => void vi.advanceTimersByTime(500))

    expect(writes).toEqual([
      ['item-1-1', { observation: 'Neumático liso', responsible: 'M. Rojas', dueDate: '2026-04-15' }],
    ])
    view.unmount()
  })

  it('keeps later values for the same field', () => {
    const view = render(<Probe />)

    act(() => {
      api.push('item-1-1', { observation: 'Neu' })
      api.push('item-1-1', { observation: 'Neumático liso' })
    })
    act(() => void vi.advanceTimersByTime(500))

    expect(writes).toEqual([['item-1-1', { observation: 'Neumático liso' }]])
    view.unmount()
  })

  it('keeps separate buffers per item', () => {
    const view = render(<Probe />)

    act(() => {
      api.push('item-1-1', { observation: 'Uno' })
      api.push('item-2-3', { observation: 'Dos' })
    })
    act(() => void vi.advanceTimersByTime(500))

    expect(writes).toHaveLength(2)
    expect(Object.fromEntries(writes)).toEqual({
      'item-1-1': { observation: 'Uno' },
      'item-2-3': { observation: 'Dos' },
    })
    view.unmount()
  })

  it('does not write before the delay elapses', () => {
    const view = render(<Probe />)
    act(() => api.push('item-1-1', { observation: 'x' }))
    act(() => void vi.advanceTimersByTime(200))
    expect(writes).toEqual([])
    view.unmount()
  })

  it('flushes on unmount so the last keystroke is never lost', () => {
    const view = render(<Probe />)
    act(() => api.push('item-1-1', { observation: 'Sin terminar' }))

    act(() => view.unmount())

    expect(writes).toEqual([['item-1-1', { observation: 'Sin terminar' }]])
  })

  it('flushes when the phone is backgrounded', () => {
    const view = render(<Probe />)
    act(() => api.push('item-1-1', { observation: 'Pantalla bloqueada' }))

    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(writes).toEqual([['item-1-1', { observation: 'Pantalla bloqueada' }]])
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    view.unmount()
  })
})
