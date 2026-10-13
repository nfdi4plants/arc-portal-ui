import { useEffect, useMemo, useReducer, useState } from 'react'
import { Banner } from '@primer/react'
import type { DataHubConnection } from '../../types/dashboard.ts'
import { DashboardHeader } from '../DashboardHeader/DashboardHeader.tsx'
import { SummaryCards } from '../SummaryCards/SummaryCards.tsx'
import { BarList } from '../BarList/BarList.tsx'
import { MonthlyChart } from '../MonthlyChart/MonthlyChart.tsx'
import { ArcTable } from '../ArcTable/ArcTable.tsx'
import { ArcFilterBar } from '../ArcFilterBar/ArcFilterBar.tsx'
import { SCOPES, type ChipKind } from '../ArcFilterBar/scopes.ts'
import { useArcIndex } from './hooks/useArcIndex.ts'
import { dashboardReducer, initialDashboardState } from './dashboardReducer.ts'
import { applyFilters, visibleArcs } from './logic/filters.ts'
import { arcsPerMonth, countBy, headlineNumbers } from './logic/summary.ts'
import { sortArcs } from './logic/sort.ts'
import styles from './DataHubDashboard.module.css'

export interface DataHubDashboardProps {
  /** One per configured DataHUB, in display order. A new array identity means "reload everything". */
  connections: DataHubConnection[]
  /** Enables the access switch and the Private card. */
  signedIn: boolean
  onArcClick: (url: string, name: string) => void
  /** Injected clock for tests. */
  now?: () => Date
}

function DataHubDashboard({ connections, signedIn, onArcClick, now = () => new Date() }: DataHubDashboardProps) {
  const { hubs, arcs, loading, updatedAt, retry, reload } = useArcIndex(connections)
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState)
  const { filters, sort } = state
  // The input responds immediately; filtering follows after a short pause.
  const [queryInput, setQueryInput] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => dispatch({ type: 'setQuery', query: queryInput }), 200)
    return () => clearTimeout(timer)
  }, [queryInput])
  const current = now()

  const accessMode = signedIn ? 'accessible' : 'public'
  const visible = useMemo(() => visibleArcs(arcs, accessMode), [arcs, accessMode])
  const hubNames = useMemo(() => new Map(connections.map(({ hub }) => [hub.id, hub.name])), [connections])
  const groupNames = useMemo(() => new Map(arcs.map(arc => [arc.group.key, arc.group.label])), [arcs])

  const filtered = useMemo(() => applyFilters(visible, filters), [visible, filters])
  const hubScoped = useMemo(() => applyFilters(visible, filters, undefined, { ignore: 'hub' }), [visible, filters])
  const groupScoped = useMemo(() => applyFilters(visible, filters, undefined, { ignore: 'group' }), [visible, filters])

  const chips: { kind: ChipKind; label: string }[] = []
  if (filters.hubId !== undefined) chips.push({ kind: 'hub', label: `DataHUB: ${hubNames.get(filters.hubId) ?? filters.hubId}` })
  if (filters.groupKey !== undefined) chips.push({ kind: 'group', label: `Working group: ${groupNames.get(filters.groupKey) ?? filters.groupKey}` })
  if (filters.access !== undefined) chips.push({ kind: 'access', label: filters.access === 'public' ? 'Shared publicly' : 'Private' })
  if (filters.query.trim()) {
    chips.push({ kind: 'query', label: `${SCOPES.find(item => item.scope === filters.scope)!.label} contains “${filters.query.trim()}”` })
  }
  const filtering = chips.length > 0

  const numbers = headlineNumbers(filtered)
  const hubCounts = countBy(hubScoped, 'hub', hubNames)
  const groupCounts = countBy(groupScoped, 'group', groupNames)
  const months = arcsPerMonth(filtered, current, 12)
  const sorted = useMemo(() => sortArcs(filtered, sort, hubNames), [filtered, sort, hubNames])

  const clearAll = () => { dispatch({ type: 'clearFilters' }); setQueryInput('') }
  const removeChip = (kind: ChipKind) => {
    dispatch({ type: 'removeFilter', kind })
    if (kind === 'query') setQueryInput('')
  }

  const failed = hubs.filter(hub => hub.status === 'failed')
  const allFailed = hubs.length > 0 && failed.length === hubs.length
  const updating = hubs.some(hub => hub.status === 'loading')

  return (
    <main className={styles.main}>
      <DashboardHeader hubCount={hubs.length} okCount={hubs.length - failed.length} updatedAt={updatedAt} now={current}
        signedIn={signedIn} accessMode={accessMode} onAccessModeChange={() => {}} onUpdate={reload} updating={updating} />
      {loading && <p role="status" className={styles.loading}>Loading ARCs from {hubs.length} DataHUBs…</p>}
      {allFailed
        ? <Banner variant="critical" title="Could not load ARCs"
          primaryAction={<Banner.PrimaryAction onClick={reload}>Try again</Banner.PrimaryAction>} />
        : <>
          {failed.map(({ hub, error }) => (
            <Banner key={hub.id} variant="warning" title={`Could not load ARCs from ${hub.name}`} description={error}
              primaryAction={<Banner.PrimaryAction onClick={() => retry(hub.id)}>{`Retry ${hub.name}`}</Banner.PrimaryAction>} />
          ))}
          <SummaryCards numbers={numbers} totals={filtering ? headlineNumbers(visible) : undefined}
            signedIn={signedIn} accessMode={accessMode} activeAccess={filters.access}
            onSelect={kind => kind === 'all' ? clearAll() : dispatch({ type: 'toggleAccess', value: kind })} />
          <div className={styles.charts}>
            <BarList title="ARCs per DataHUB" items={hubCounts} activeKey={filters.hubId}
              onToggle={value => dispatch({ type: 'toggleHub', value })} />
            <BarList title="ARCs per working group" items={groupCounts} activeKey={filters.groupKey}
              onToggle={value => dispatch({ type: 'toggleGroup', value })} />
            <MonthlyChart months={months} />
          </div>
          <ArcFilterBar query={queryInput} scope={filters.scope} onQueryChange={setQueryInput}
            onScopeChange={scope => dispatch({ type: 'setScope', scope })}
            chips={chips} onRemoveChip={removeChip} onClearAll={clearAll} shown={filtered.length} total={visible.length} />
          <ArcTable arcs={sorted} hubNames={hubNames} sort={sort} now={current}
            onSortChange={next => dispatch({ type: 'setSort', sort: next })}
            resetKey={JSON.stringify(filters) + JSON.stringify(sort)}
            onClearFilters={filtering ? clearAll : undefined}
            onOpen={arc => onArcClick(arc.url, arc.title)} />
        </>}
    </main>
  )
}

export default DataHubDashboard
