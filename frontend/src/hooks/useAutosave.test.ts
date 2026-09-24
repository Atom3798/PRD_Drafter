import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutosave } from '@/hooks/useAutosave'

type Payload = { inputs?: Record<string, string>; title?: string }

const merge = (pending: Payload, next: Payload): Payload => ({
  ...pending,
  ...next,
  inputs: { ...pending.inputs, ...next.inputs },
})

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves once after the debounce, not once per change', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    act(() => {
      result.current.schedule({ inputs: { idea: 'a' } })
      result.current.schedule({ inputs: { idea: 'ab' } })
      result.current.schedule({ inputs: { idea: 'abc' } })
    })
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ inputs: { idea: 'abc' } })
  })

  it('keeps earlier fields when another is edited inside the same window', async () => {
    // The regression this test exists for: answering two questions within one
    // debounce window used to save only the second, silently losing the first.
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    act(() => {
      result.current.schedule({ inputs: { product_name: 'Pantry' } })
      result.current.schedule({ inputs: { idea: 'A recipe app' } })
      result.current.schedule({ inputs: { problem: 'Recipes get lost' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(onSave).toHaveBeenCalledWith({
      inputs: {
        product_name: 'Pantry',
        idea: 'A recipe app',
        problem: 'Recipes get lost',
      },
    })
  })

  it('merges across payload shapes, not just within inputs', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    act(() => {
      result.current.schedule({ title: 'Pantry' })
      result.current.schedule({ inputs: { idea: 'An idea' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(onSave).toHaveBeenCalledWith({
      title: 'Pantry',
      inputs: { idea: 'An idea' },
    })
  })

  it('flush saves immediately without waiting for the debounce', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    act(() => {
      result.current.schedule({ inputs: { idea: 'now' } })
    })
    await act(async () => {
      await result.current.flush()
    })

    expect(onSave).toHaveBeenCalledWith({ inputs: { idea: 'now' } })
  })

  it('flush is a no-op when nothing is pending', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    await act(async () => {
      await result.current.flush()
    })

    expect(onSave).not.toHaveBeenCalled()
  })

  it('reports status through the save cycle', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    expect(result.current.status).toBe('idle')

    act(() => {
      result.current.schedule({ inputs: { idea: 'x' } })
    })
    expect(result.current.status).toBe('unsaved')

    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.status).toBe('saved')
  })

  it('keeps the payload and reports an error when saving fails', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    act(() => {
      result.current.schedule({ inputs: { idea: 'important' } })
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.status).toBe('error')
    expect(result.current.hasPendingChanges()).toBe(true)

    // The retry must still carry the edit that failed.
    await act(async () => {
      await result.current.flush()
    })
    expect(onSave).toHaveBeenLastCalledWith({ inputs: { idea: 'important' } })
  })

  it('does not lose an edit made while a failed save was in flight', async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useAutosave<Payload>({ onSave, merge }))

    act(() => {
      result.current.schedule({ inputs: { idea: 'first' } })
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.status).toBe('error')

    act(() => {
      result.current.schedule({ inputs: { problem: 'second' } })
    })
    await act(async () => {
      await result.current.flush()
    })

    expect(onSave).toHaveBeenLastCalledWith({
      inputs: { idea: 'first', problem: 'second' },
    })
  })

  it('saves a pending change when the component unmounts', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result, unmount } = renderHook(() =>
      useAutosave<Payload>({ onSave, merge }),
    )

    act(() => {
      result.current.schedule({ inputs: { idea: 'leaving' } })
    })
    unmount()

    expect(onSave).toHaveBeenCalledWith({ inputs: { idea: 'leaving' } })
  })
})
