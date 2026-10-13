import { useEffect, useMemo, useReducer, useState } from 'react'
import { Banner } from '@primer/react'
import type { DataHubFetchers, FilterKind } from '../../types/dashboard.ts'
import type { GitLabInstance } from '../../types/gitlab.ts'
import { availableDataHubs } from '../../config/gitlab.ts'
import { getProjectCount } from '../../api/gitlab/index.ts'
import { DashboardHeader } from '../DashboardHeader/DashboardHeader.tsx'
import { StatsSidebar } from '../StatsSidebar/StatsSidebar.tsx'
import { BarList } from '../BarList/BarList.tsx'
import { WorkingGroupChart } from '../WorkingGroupChart/WorkingGroupChart.tsx'
import { MonthlyChart } from '../MonthlyChart/MonthlyChart.tsx'
import { ArcsTable } from '../ArcTable/ArcTable.tsx'
import { ArcFilterBar } from '../ArcFilterBar/ArcFilterBar.tsx'
import { useArcIndex } from './hooks/useArcIndex.ts'
import { useArcDetails } from './hooks/useArcDetails.ts'
import { dashboardReducer, initialDashboardState } from './dashboardReducer.ts'
import { applyFilters } from './logic/filters.ts'
import { arcsPerMonth, countBy, headlineNumbers } from './logic/summary.ts'
import { sortArcs } from './logic/sort.ts'
import styles from './DataHubDashboard.module.css'
import { Stack } from '@primer/react'

export interface DataHubDashboardProps extends DataHubFetchers {
  /** Configured DataHUBs, in display order. Defaults to all supported instances. */
  dataHubs?: GitLabInstance[]
  /** Session tokens keyed by DataHUB id. */
  tokens?: Record<string, string>
  fetchProjectCount?: typeof getProjectCount
  onArcClick: (url: string, name: string, projectId: number, dataHub: GitLabInstance) => void
  /** Injected clock for tests. */
  now?: () => Date
}

function DataHubDashboard({ dataHubs = availableDataHubs, tokens, fetchProjects, fetchGroups, fetchMemberProjectIds,
  fetchContributors, fetchLatestCommit, fetchProjectCount = getProjectCount, onArcClick, now = () => new Date() }: DataHubDashboardProps) {
  // Authentication status updates should not reload ARCs unless a token actually changes.
  const tokenSignature = JSON.stringify(dataHubs.map(hub => tokens?.[hub.id] ?? null))
  const connections = useMemo(() => {
    const currentTokens: (string | null)[] = JSON.parse(tokenSignature)
    return dataHubs.map((hub, index) => ({ hub, token: currentTokens[index] ?? undefined }))
  }, [dataHubs, tokenSignature])
  const { hubs, arcs, loading, updatedAt, retry, reload } = useArcIndex(connections, {
    fetchProjects, fetchGroups, fetchMemberProjectIds,
  })
  useEffect(() => {
    const controller = new AbortController()
    for (const { hub, token } of connections) {
      void fetchProjectCount(hub.url, { token, signal: controller.signal }).then(result => {
        if (!controller.signal.aborted) console.log('GitLab project count', hub.url, result)
      })
    }
    return () => controller.abort()
  }, [connections, fetchProjectCount])
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState)
  const { filters, sort } = state
  // The input responds immediately; filtering follows after a short pause.
  const [queryInput, setQueryInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'setQuery', query: queryInput }), 200)
    return () => clearTimeout(timer)
  }, [queryInput])
  const current = now()

  const hubNames = useMemo(() => new Map(connections.map(({ hub }) => [hub.id, hub.name])), [connections])
  const groupNames = useMemo(() => new Map(arcs.map(arc => [arc.group.key, arc.group.label])), [arcs])

  const connectionsByHub = useMemo(() => new Map(connections.map(connection => [connection.hub.id, connection])), [connections])
  // Newest first keeps the newest ARCs' avatars filling in first.
  const detailOrder = useMemo(() => sortArcs(arcs, { column: 'lastChange', direction: 'DESC' }, hubNames), [arcs, hubNames])
  const { details } = useArcDetails(detailOrder, connectionsByHub, { fetchContributors, fetchLatestCommit })

  const filtered = useMemo(() => applyFilters(arcs, filters, details, { now: current }), [arcs, filters, details, current])
  const hubScoped = useMemo(() => applyFilters(arcs, filters, details, { now: current, ignore: 'hub' }), [arcs, filters, details, current])
  const groupScoped = useMemo(() => applyFilters(arcs, filters, details, { now: current, ignore: 'group' }), [arcs, filters, details, current])

  const chips: { kind: FilterKind; label: string }[] = []
  if (filters.hubId !== undefined) chips.push({ kind: 'hub', label: `DataHUB: ${hubNames.get(filters.hubId) ?? filters.hubId}` })
  if (filters.groupKey !== undefined) chips.push({ kind: 'group', label: `Working group: ${groupNames.get(filters.groupKey) ?? filters.groupKey}` })
  if (filters.access !== undefined) chips.push({ kind: 'access', label: filters.access === 'public' ? 'Shared publicly' : 'Private' })
  if (filters.recent) chips.push({ kind: 'recent', label: 'Changed in the last 30 days' })
  if (filters.query.trim()) chips.push({ kind: 'query', label: `Search: “${filters.query.trim()}”` })
  const filtering = chips.length > 0

  const numbers = useMemo(() => headlineNumbers(filtered, details), [filtered, details])
  const totals = useMemo(() => filtering ? headlineNumbers(arcs, details) : undefined, [arcs, details, filtering])
  const hubCounts = useMemo(() => countBy(hubScoped, 'hub', hubNames), [hubScoped, hubNames])
  const myGroupCounts = useMemo(() => countBy(groupScoped.filter(arc => arc.member), 'group', groupNames, hubNames), [groupScoped, groupNames, hubNames])
  const publicGroupCounts = useMemo(() => countBy(groupScoped.filter(arc => arc.access === 'public'), 'group', groupNames, hubNames), [groupScoped, groupNames, hubNames])
  // The chart buckets depend on the calendar month, not on the clock's time of day.
  const currentMonth = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the month key, not the Date, drives the buckets.
  const months = useMemo(() => arcsPerMonth(filtered, current, 12), [filtered, currentMonth])
  const sorted = useMemo(() => sortArcs(filtered, sort, hubNames), [filtered, sort, hubNames])

  const clearAll = () => { dispatch({ type: 'clearFilters' }); setQueryInput('') }
  const removeChip = (kind: FilterKind) => {
    dispatch({ type: 'removeFilter', kind })
    if (kind === 'query') setQueryInput('')
  }

  const failed = hubs.filter(hub => hub.status === 'failed')
  const allFailed = hubs.length > 0 && failed.length === hubs.length
  const updating = hubs.some(hub => hub.status === 'loading')
  const membershipErrors = hubs.filter(hub => hub.membershipError !== undefined).map(hub => hub.hub.name)

  const rejectedIds = new Set(hubs.filter(hub => hub.tokenRejected).map(hub => hub.hub.id))
  const loggedInHubs = connections.filter(connection => connection.token && !rejectedIds.has(connection.hub.id))
  const signedIn = loggedInHubs.length > 0
  const privateState = loggedInHubs.length === 0 ? 'hidden' : loggedInHubs.length === connections.length ? 'all' : 'partial'
  const privateNote = privateState === 'partial'
    ? `Private ARCs are included from ${loggedInHubs.map(connection => connection.hub.name).join(', ')} only.`
    : undefined

  return (
    <main className={styles.main}>
      <DashboardHeader hubCount={hubs.length} okCount={hubs.length - failed.length} updatedAt={updatedAt} now={current}
        onUpdate={reload} updating={updating} />
      {loading && <p role="status" className={styles.loading}>Loading ARCs from {hubs.length} DataHUBs…</p>}
      {loading ? null : allFailed
        ? <Banner variant="critical" title="Could not load ARCs"
          primaryAction={<Banner.PrimaryAction onClick={reload}>Try again</Banner.PrimaryAction>} />
        : <>
          {failed.map(({ hub, error }) => (
            <Banner key={hub.id} variant="warning" title={`Could not load ARCs from ${hub.name}`} description={error}
              primaryAction={<Banner.PrimaryAction onClick={() => retry(hub.id)}>{`Retry ${hub.name}`}</Banner.PrimaryAction>} />
          ))}
          {hubs.filter(hub => hub.tokenRejected).map(({ hub }) => (
            <Banner key={hub.id} variant="warning" title={`Your login for ${hub.name} has expired`}>
              Showing public ARCs only. Log in again to see private ARCs.
            </Banner>
          ))}
          <div className={styles.grid}>
            <StatsSidebar numbers={numbers} totals={totals} filtersActive={filtering} activeAccess={filters.access}
              onSelect={kind => kind === 'all' ? clearAll() : dispatch({ type: 'toggleAccess', value: kind })}
              privateState={privateState} privateNote={privateNote} />
            <div className={styles.content}>
              <div className={styles.charts}>
                <BarList title="ARCs per DataHUB" items={hubCounts} activeKey={filters.hubId}
                  onToggle={value => dispatch({ type: 'toggleHub', value })} />
                <WorkingGroupChart myItems={myGroupCounts} publicItems={publicGroupCounts} loggedIn={signedIn}
                  membershipErrors={membershipErrors} activeKey={filters.groupKey}
                  onToggle={value => dispatch({ type: 'toggleGroup', value })} />
                <MonthlyChart months={months} />
              </div>
              <Stack>
                <ArcFilterBar query={queryInput} onQueryChange={setQueryInput} recent={filters.recent}
                  onRecentToggle={() => dispatch({ type: 'toggleRecent' })}
                  chips={chips} onRemoveChip={removeChip} onClearAll={clearAll} shown={filtered.length} total={arcs.length} />
                <ArcsTable 
                  arcs={sorted} 
                  hubNames={hubNames} 
                  sort={sort} 
                  now={current} 
                  details={details}
                  onSortChange={next => dispatch({ type: 'setSort', sort: next })}
                  resetKey={JSON.stringify(filters) + JSON.stringify(sort)}
                  onClearFilters={filtering ? clearAll : undefined}
                  onOpen={arc => onArcClick(arc.url, arc.title, arc.projectId, connectionsByHub.get(arc.hubId)!.hub)} />
              </Stack>
            </div>
          </div>
        </>}
    </main>
  )
  return <div>Loaded</div>
}

export default DataHubDashboard
