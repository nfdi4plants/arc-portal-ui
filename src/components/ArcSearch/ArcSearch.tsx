import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Button, Spinner, TextInput } from '@primer/react'
import type { SearchArcs } from '../../types/arc.ts'
import { useProjectPage } from '../../util/useProjectPage.ts'
import { ArcList } from '../ArcList/ArcList.tsx'
import styles from './ArcSearch.module.css'

export function ArcSearch({ fetchCall }: { fetchCall: SearchArcs }) {
  const headingId = useId()
  const inputId = useId()
  const hintId = useId()
  const [input, setInput] = useState('')
  const [request, setRequest] = useState<{ fetchCall: SearchArcs; query: string; page: number } | null>(null)
  const activeRequest = request?.fetchCall === fetchCall ? request : null
  const load = useMemo(() => activeRequest
    ? (signal: AbortSignal) => fetchCall(activeRequest.query, { page: activeRequest.page, perPage: 10, signal })
    : null, [fetchCall, activeRequest])
  const state = useProjectPage(load)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = input.trim()
    if (query) setRequest({ fetchCall, query, page: 1 })
  }

  function goToPage(page: number) {
    if (activeRequest) setRequest({ ...activeRequest, page })
  }

  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId}>Search ARCs</h2>
      <p id={hintId} className={styles.subtitle}>Find public research contexts by name, path, or description.</p>
      <form onSubmit={submit} className={styles.form} role="search" aria-label="Search ARCs">
        <label htmlFor={inputId} className={styles.label}>Search term</label>
        <div className={styles.controls}>
          <TextInput id={inputId} aria-describedby={hintId} value={input} onChange={event => setInput(event.target.value)} placeholder="e.g. Arabidopsis" className={styles.input} />
          <Button type="submit" variant="primary" disabled={!input.trim()}>Search</Button>
        </div>
      </form>
      {state.status === 'idle' && <p className={styles.status}>Enter a term to discover ARCs.</p>}
      {state.status === 'loading' && <p role="status" className={styles.status}><Spinner size="small" /> Searching ARCs…</p>}
      {state.status === 'error' && <div role="alert" className={styles.error}><p>{state.error}</p><Button onClick={state.retry}>Retry search</Button></div>}
      {state.status === 'success' && activeRequest && <>
        <p role="status" className={styles.status}>
          {state.result.items.length
            ? `${state.result.items.length} results for “${activeRequest.query}” · Page ${state.result.page}`
            : `No ARCs found for “${activeRequest.query}” on page ${state.result.page}.`}
        </p>
        {state.result.items.length > 0 && <ArcList projects={state.result.items} label="ARC search results" />}
        <nav aria-label="Search result pages" className={styles.pagination}>
          <Button disabled={state.result.previousPage === null} onClick={() => goToPage(state.result.previousPage!)}>Previous</Button>
          <span>Page {state.result.page}</span>
          <Button disabled={state.result.nextPage === null} onClick={() => goToPage(state.result.nextPage!)}>Next</Button>
        </nav>
      </>}
    </section>
  )
}
