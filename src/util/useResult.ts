import { useEffect, useState } from 'react'
import type { Result } from '../types/result.ts'

type Loader<T> = (signal: AbortSignal) => Promise<Result<T>>
type State<T> =
  | { status: 'idle' | 'loading'; result?: never; error?: never }
  | { status: 'success'; result: T; error?: never }
  | { status: 'error'; result?: never; error: string }

/** Retire old requests when their loader changes, including login/logout. */
export function useResult<T>(load: Loader<T> | null) {
  const [settled, setSettled] = useState<{ load: Loader<T>; attempt: number; state: State<T> } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!load) return
    const controller = new AbortController()
    void load(controller.signal).then(
      result => {
        if (!controller.signal.aborted) setSettled({ load, attempt, state: result.success === true
          ? { status: 'success', result: result.value }
          : { status: 'error', error: result.error } })
      },
      error => {
        // Keep injected callbacks from causing an unhandled rejection.
        if (!controller.signal.aborted) setSettled({ load, attempt,
          state: { status: 'error', error: error instanceof Error ? error.message : 'Unable to load data.' } })
      },
    )
    return () => controller.abort()
  }, [load, attempt])

  const state: State<T> = !load
    ? { status: 'idle' }
    : settled?.load === load && settled.attempt === attempt
      ? settled.state
      : { status: 'loading' }
  return { ...state, retry: () => setAttempt(value => value + 1) }
}
