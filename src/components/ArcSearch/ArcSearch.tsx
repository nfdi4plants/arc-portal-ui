import { useId, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Banner, Button, FormControl, Heading, Stack, Text, TextInput } from '@primer/react'
import type { SearchArcs } from '../../types/arc.ts'
import { useProjectPage } from '../../util/useProjectPage.ts'
import { ArcList } from '../ArcList/ArcList.tsx'
import { ArcListSkeleton } from '../ArcList/ArcListSkeleton.tsx'
import styles from './ArcSearch.module.css'

export function ArcSearch({ fetchCall, signedIn = false, onArcClick }: { fetchCall: SearchArcs; signedIn?: boolean; onArcClick?: (url: string, name: string, projectId: number) => void }) {
  const headingId = useId()
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
      <Heading as="h2" variant="medium" id={headingId} className={styles.heading}>Search ARCs</Heading>
      <Text as="p" size="medium" className={styles.subtitle}>{signedIn
        ? 'Find research contexts you can access by name, path, or description.'
        : 'Find public research contexts by name, path, or description.'}</Text>
      <form onSubmit={submit} className={styles.form} role="search" aria-label="Search ARCs">
        <FormControl className={styles.field}>
          <FormControl.Label>Search term</FormControl.Label>
          <TextInput block value={input} onChange={event => setInput(event.target.value)} placeholder="e.g. Arabidopsis" />
          <FormControl.Caption>Search names, paths, and descriptions.</FormControl.Caption>
        </FormControl>
        <Button type="submit" variant="primary" disabled={!input.trim()} className={styles.submit}>Search</Button>
      </form>
      {state.status === 'idle' && <Text as="p" size="medium" className={styles.status}>Enter a term to discover ARCs.</Text>}
      {state.status === 'loading' && <ArcListSkeleton label="Searching ARCs…" />}
      {state.status === 'error' && (
        <Banner variant="critical" role="alert" className={styles.error}
          primaryAction={<Banner.PrimaryAction onClick={state.retry}>Retry search</Banner.PrimaryAction>}>
          <Banner.Title as="h3">Unable to search ARCs</Banner.Title>
          <Banner.Description>{state.error}</Banner.Description>
        </Banner>
      )}
      {state.status === 'success' && activeRequest && <>
        <Text as="p" size="medium" role="status" className={styles.status}>
          {state.result.items.length
            ? `${state.result.items.length} results for “${activeRequest.query}” · Page ${state.result.page}`
            : `No ARCs found for “${activeRequest.query}” on page ${state.result.page}.`}
        </Text>
        {state.result.items.length > 0 && <ArcList projects={state.result.items} label="ARC search results" onArcClick={onArcClick} />}
        <Stack as="nav" direction="horizontal" align="center" justify="space-between" gap="condensed" aria-label="Search result pages" className={styles.pagination}>
          <Button disabled={state.result.previousPage === null} onClick={() => goToPage(state.result.previousPage!)}>Previous</Button>
          <Text size="medium">Page {state.result.page}</Text>
          <Button disabled={state.result.nextPage === null} onClick={() => goToPage(state.result.nextPage!)}>Next</Button>
        </Stack>
      </>}
    </section>
  )
}
