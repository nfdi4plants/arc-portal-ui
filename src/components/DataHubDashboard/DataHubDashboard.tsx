import { useMemo, useReducer, useState } from 'react'
import { Banner, SkeletonBox, Stack } from '@primer/react'
import { PROJECT_COUNT_LIMIT } from '../../api/gitlab/projectCount.ts'
import type { DataHubFetchers, FilterKind } from '../../types/dashboard.ts'
import type { GitLabInstance } from '../../types/gitlab.ts'
import { availableDataHubs } from '../../config/gitlab.ts'
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

export interface DataHubDashboardProps extends DataHubFetchers {
  /** Configured DataHUBs, in display order. Defaults to all supported instances. */
  dataHubs?: GitLabInstance[]
  /** Session tokens keyed by DataHUB id. */
  tokens?: Record<string, string>
  onArcClick: (url: string, name: string, projectId: number, dataHub: GitLabInstance) => void
  /** Injected clock for tests. */
  now?: () => Date
}

function DashboardPlaceholder({ label, unavailable = false }: { label: string; unavailable?: boolean }) {
  return <section className={styles.placeholder} aria-label={label} aria-busy={!unavailable}>
    <h2 className={styles.placeholderTitle}>{label}</h2>
    {unavailable ? <p>Data unavailable.</p> : <div className={styles.placeholderRows} aria-hidden="true">
      {[0, 1, 2].map(row => <SkeletonBox key={row} height="24px" width={row === 1 ? '75%' : '100%'} />)}
    </div>}
  </section>
}

function DataHubDashboard({ dataHubs = availableDataHubs, tokens, fetchProjects, fetchGroups, fetchMemberProjectIds, fetchProjectCount,
  fetchContributors, fetchLatestCommit, onArcClick, now = () => new Date() }: DataHubDashboardProps) {
  // Authentication status updates should not reload ARCs unless a token actually changes.
  const tokenSignature = JSON.stringify(dataHubs.map(hub => tokens?.[hub.id] ?? null))
  const connections = useMemo(() => {
    const currentTokens: (string | null)[] = JSON.parse(tokenSignature)
    return dataHubs.map((hub, index) => ({ hub, token: currentTokens[index] ?? undefined }))
  }, [dataHubs, tokenSignature])
  const { hubs, arcs, loading, updatedAt, retry, reload } = useArcIndex(connections, {
    fetchProjects, fetchGroups, fetchMemberProjectIds, fetchProjectCount,
  })
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState)
  const { filters, sort } = state
  // The search bar owns its draft. Reset it only when the search is cleared.
  const [searchResetKey, setSearchResetKey] = useState(0)
  const current = now()

  const hubNames = useMemo(() => new Map(connections.map(({ hub }) => [hub.id, hub.name])), [connections])
  const groupNames = useMemo(() => new Map(arcs.map(arc => [arc.group.key, arc.group.label])), [arcs])

  const connectionsByHub = useMemo(() => new Map(connections.map(connection => [connection.hub.id, connection])), [connections])
  // Newest first keeps the newest ARCs' avatars filling in first.
  const detailOrder = useMemo(() => sortArcs(arcs, { column: 'lastChange', direction: 'DESC' }, hubNames), [arcs, hubNames])
  const { details } = useArcDetails(detailOrder, connectionsByHub, { fetchContributors, fetchLatestCommit })

  const filtered = useMemo(() => applyFilters(arcs, filters, details, { now: current }), [arcs, filters, details, current])
  // Each overview depends only on selections to its left, never on the search below.
  const groupScoped = useMemo(() => filters.hubId === undefined ? arcs : arcs.filter(arc => arc.hubId === filters.hubId), [arcs, filters.hubId])
  const chartScoped = useMemo(() => groupScoped.filter(arc =>
    (filters.groupKey === undefined || arc.group.key === filters.groupKey)
    && (filters.access === undefined || arc.access === filters.access)), [groupScoped, filters.groupKey, filters.access])

  const chips: { kind: FilterKind; label: string }[] = []
  if (filters.hubId !== undefined) chips.push({ kind: 'hub', label: `DataHUB: ${hubNames.get(filters.hubId) ?? filters.hubId}` })
  if (filters.groupKey !== undefined) chips.push({ kind: 'group', label: `Working group: ${groupNames.get(filters.groupKey) ?? filters.groupKey}` })
  if (filters.access !== undefined) chips.push({ kind: 'access', label: filters.access === 'public' ? 'Shared publicly' : 'Private' })
  if (filters.recent) chips.push({ kind: 'recent', label: 'Changed in the last 30 days' })
  if (filters.query.trim()) chips.push({ kind: 'query', label: `Search: “${filters.query.trim()}”` })
  const filtering = chips.length > 0

  const numbers = useMemo(() => ({ ...headlineNumbers(arcs, details), hubs: connections.length }), [arcs, details, connections.length])
  const hubCounts = useMemo(() => {
    return hubs.map(hub => {
      const count = hub.projectCount ?? (hub.status === 'loaded' || hub.arcs.length > 0 ? hub.arcs.length : null)
      return { key: hub.hub.id, label: hub.hub.name, count: count === null ? null : Math.min(count, PROJECT_COUNT_LIMIT),
        loading: count === null && (hub.status === 'loading' || hub.projectCount === undefined),
        capped: count !== null && count >= PROJECT_COUNT_LIMIT }
    })
  }, [hubs])
  const myGroupCounts = useMemo(() => countBy(groupScoped.filter(arc => arc.member), 'group', groupNames, hubNames), [groupScoped, groupNames, hubNames])
  const publicGroupCounts = useMemo(() => countBy(groupScoped.filter(arc => arc.access === 'public'), 'group', groupNames, hubNames), [groupScoped, groupNames, hubNames])
  // The chart buckets depend on the calendar month, not on the clock's time of day.
  const currentMonth = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- the month key, not the Date, drives the buckets.
  const months = useMemo(() => arcsPerMonth(chartScoped, current, 12), [chartScoped, currentMonth])
  const sorted = useMemo(() => sortArcs(filtered, sort, hubNames), [filtered, sort, hubNames])

  const clearAll = () => { dispatch({ type: 'clearFilters' }); setSearchResetKey(key => key + 1) }
  const removeChip = (kind: FilterKind) => {
    dispatch({ type: 'removeFilter', kind })
    if (kind === 'query') setSearchResetKey(key => key + 1)
  }

  const failed = hubs.filter(hub => hub.status === 'failed')
  const allFailed = hubs.length > 0 && failed.length === hubs.length
  const updating = hubs.some(hub => hub.status === 'loading')
  const overviewLoading = hubs.some(hub => hub.status === 'loading' && hub.arcs.length === 0)
  const scopedHubs = hubs.filter(hub => filters.hubId === undefined || hub.hub.id === filters.hubId)
  const groupsLoading = scopedHubs.some(hub => hub.status === 'loading' && hub.arcs.length === 0)
  const groupsUnavailable = scopedHubs.length > 0 && scopedHubs.every(hub => hub.status === 'failed' && hub.arcs.length === 0)
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
      {allFailed && <Banner variant="critical" title="Could not load ARCs"
        primaryAction={<Banner.PrimaryAction onClick={reload}>Try again</Banner.PrimaryAction>} />}
      {!allFailed && failed.map(({ hub, error }) => (
        <Banner key={hub.id} variant="warning" title={`Could not load ARCs from ${hub.name}`} description={error}
          primaryAction={<Banner.PrimaryAction onClick={() => retry(hub.id)}>{`Retry ${hub.name}`}</Banner.PrimaryAction>} />
      ))}
      {hubs.filter(hub => hub.tokenRejected).map(({ hub }) => (
        <Banner key={hub.id} variant="warning" title={`Your login for ${hub.name} has expired`}>
          Showing public ARCs only. Log in again to see private ARCs.
        </Banner>
      ))}
      <div className={styles.grid}>
        {overviewLoading || allFailed ? <DashboardPlaceholder label="Summary" unavailable={allFailed} />
          : <StatsSidebar numbers={numbers} filtersActive={filtering} activeAccess={filters.access}
              onSelect={kind => kind === 'all' ? clearAll() : dispatch({ type: 'toggleAccess', value: kind })}
              privateState={privateState} privateNote={privateNote} />}
        <div className={styles.content}>
          <div className={styles.charts}>
            <BarList title="ARCs per DataHUB" items={hubCounts} max={hubCounts.length} activeKey={filters.hubId}
              onToggle={value => dispatch({ type: 'toggleHub', value })} />
            {groupsLoading || groupsUnavailable ? <DashboardPlaceholder label="ARCs per working group" unavailable={groupsUnavailable} />
              : <WorkingGroupChart myItems={myGroupCounts} publicItems={publicGroupCounts} loggedIn={signedIn}
                  membershipErrors={membershipErrors} activeKey={filters.groupKey}
                  onToggle={value => dispatch({ type: 'toggleGroup', value })} />}
            {groupsLoading || groupsUnavailable ? <DashboardPlaceholder label="New ARCs per month" unavailable={groupsUnavailable} />
              : <MonthlyChart months={months} />}
          </div>
          <Stack>
            <ArcFilterBar key={searchResetKey} query={filters.query} onSearch={query => dispatch({ type: 'setQuery', query })} recent={filters.recent}
              onRecentToggle={() => dispatch({ type: 'toggleRecent' })}
              chips={chips} onRemoveChip={removeChip} onClearAll={clearAll} shown={filtered.length} total={arcs.length}
              loading={overviewLoading} unavailable={allFailed} />
            {(loading || groupsLoading || groupsUnavailable) && filtered.length === 0
              ? <DashboardPlaceholder label="ARCs" unavailable={groupsUnavailable} /> : <ArcsTable
                  arcs={sorted}
                  hubNames={hubNames}
                  sort={sort}
                  now={current}
                  details={details}
                  onSortChange={next => dispatch({ type: 'setSort', sort: next })}
                  resetKey={JSON.stringify(filters) + JSON.stringify(sort)}
                  onClearFilters={filtering ? clearAll : undefined}
                  onOpen={arc => onArcClick(arc.url, arc.title, arc.projectId, connectionsByHub.get(arc.hubId)!.hub)} />}
          </Stack>
        </div>
      </div>
    </main>
  )
}

export default DataHubDashboard
