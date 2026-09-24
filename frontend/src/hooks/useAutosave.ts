import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 2_000

/**
 * Debounced autosave with an explicit status for the UI.
 *
 * The contract this has to keep is "closing the tab never loses an answer",
 * which needs more than a timer:
 *
 * - typing resets a 2s debounce, so we save on a pause rather than per key
 * - `flush()` saves immediately, used on step change and Cmd/Ctrl+S
 * - a pending change is flushed on unmount and on tab hide, so navigating
 *   away or backgrounding the tab does not drop the last few seconds
 * - a failed save keeps the pending payload and stays in 'error', so the
 *   next attempt still carries the earlier edit
 *
 * `merge` decides what happens when a second change is queued before the
 * first has saved. The default replaces, which is wrong for a form: typing in
 * field A and then field B inside the debounce window would discard A. Pass a
 * merge function to accumulate instead.
 *
 * The saver is held in a ref: callers pass an inline arrow, and re-subscribing
 * every render would restart the debounce forever.
 */
export function useAutosave<T>({
  onSave,
  merge,
  debounceMs = DEBOUNCE_MS,
}: {
  onSave: (payload: T) => Promise<unknown>
  merge?: (pending: T, next: T) => T
  debounceMs?: number
}) {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const pendingRef = useRef<T | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onSaveRef = useRef(onSave)
  const mergeRef = useRef(merge)
  const mountedRef = useRef(true)

  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  useEffect(() => {
    mergeRef.current = merge
  }, [merge])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const save = useCallback(async () => {
    const payload = pendingRef.current
    if (payload === null) return

    // Clear before awaiting so edits made during the request are not lost.
    pendingRef.current = null
    clearTimer()
    if (mountedRef.current) setStatus('saving')

    try {
      await onSaveRef.current(payload)
      if (!mountedRef.current) return
      // Something was typed while saving - stay dirty rather than lying.
      setStatus(pendingRef.current === null ? 'saved' : 'unsaved')
    } catch {
      // Put it back so the next attempt still carries this edit, merging
      // under anything typed while the failed request was in flight.
      const newer = pendingRef.current
      pendingRef.current =
        newer !== null && mergeRef.current ? mergeRef.current(payload, newer) : payload
      if (mountedRef.current) setStatus('error')
    }
  }, [clearTimer])

  /** Queue a change. Saves after the debounce. */
  const schedule = useCallback(
    (payload: T) => {
      const pending = pendingRef.current
      // Accumulate rather than overwrite, so a change queued a moment ago is
      // not dropped by the next keystroke in a different field.
      pendingRef.current =
        pending !== null && mergeRef.current
          ? mergeRef.current(pending, payload)
          : payload
      setStatus('unsaved')
      clearTimer()
      timerRef.current = setTimeout(() => void save(), debounceMs)
    },
    [clearTimer, debounceMs, save],
  )

  /** Save right now, skipping the debounce. */
  const flush = useCallback(async () => {
    clearTimer()
    await save()
  }, [clearTimer, save])

  const hasPendingChanges = useCallback(() => pendingRef.current !== null, [])

  // Flush on unmount, so leaving the page saves the last edit.
  useEffect(() => {
    return () => {
      if (pendingRef.current !== null) void onSaveRef.current(pendingRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // Flush when the tab is hidden. On mobile this is often the only signal
  // before the page is frozen or discarded.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden' && pendingRef.current !== null) {
        void save()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [save])

  // Last-resort browser warning if a save is still outstanding.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (pendingRef.current !== null) event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  return { status, schedule, flush, hasPendingChanges }
}
