import { useEffect, useState } from 'react'
import type { ArcPage, FetchArcs } from '../types/arc.ts'

type PageLoader = FetchArcs
type PageState =
  | { status: 'idle' | 'loading'; result?: never; error?: never }
  | { status: 'success'; result: ArcPage; error?: never }
  | { status: 'error'; result?: never; error: string }

/** Memoized loaders retire and abort their old request whenever they change. */
export function useProjectPage(load: PageLoader | null) {
  const [settled, setSettled] = useState<{ load: PageLoader; attempt: number; state: PageState } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!load) return
    const controller = new AbortController()
    void load(controller.signal).then(
      result => {
        if (!controller.signal.aborted) setSettled({ load, attempt, state: { status: 'success', result } })
      },
      error => {
        if (!controller.signal.aborted) {
          setSettled({ load, attempt, state: { status: 'error', error: error instanceof Error ? error.message : 'Unable to load ARCs.' } })
        }
      },
    )
    return () => controller.abort()
  }, [load, attempt])

  const state: PageState = !load
    ? { status: 'idle' }
    : settled?.load === load && settled.attempt === attempt
      ? settled.state
      : { status: 'loading' }
  return { ...state, retry: () => setAttempt(value => value + 1) }
}
