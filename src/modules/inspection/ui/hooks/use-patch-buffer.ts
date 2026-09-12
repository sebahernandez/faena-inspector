import { useCallback, useEffect, useRef } from 'react'

/**
 * Buffers partial edits per key and writes them once the typing stops.
 *
 * Why not a plain debounce: a plain debounce keeps ONE pending value and every
 * new call replaces it. Typing an observation and then moving to "Responsable"
 * within the delay cancels the observation — silent data loss on a document
 * that will be signed. So patches MERGE per key instead of replacing.
 *
 * The buffer is also flushed when the component unmounts and when the phone is
 * backgrounded, because the inspector will lock the screen mid-sentence.
 */
export function usePatchBuffer<P extends object>(
  write: (key: string, patch: P) => void,
  delayMs = 400,
) {
  const pending = useRef(new Map<string, P>())
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latest = useRef(write)

  useEffect(() => {
    latest.current = write
  }, [write])

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    if (pending.current.size === 0) return
    const entries = [...pending.current.entries()]
    pending.current.clear()
    for (const [key, patch] of entries) latest.current(key, patch)
  }, [])

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      flush() // never leave a keystroke unwritten on the way out
    }
  }, [flush])

  const push = useCallback(
    (key: string, patch: P) => {
      pending.current.set(key, { ...pending.current.get(key), ...patch } as P)
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, delayMs)
    },
    [delayMs, flush],
  )

  return { push, flush }
}
