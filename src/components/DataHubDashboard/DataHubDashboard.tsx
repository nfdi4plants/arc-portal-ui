import { useMemo, useState } from 'react'
import { Banner, SegmentedControl, SkeletonBox, Stack } from '@primer/react'
import { useAuthentication } from '../../auth/context.ts'
import { defaultDataHub } from '../../config/gitlab.ts'
import { PROJECT_COUNT_LIMIT } from '../../api/gitlab/projectCount.ts'
import type { FilterKind, SortState } from '../../types/dashboard.ts'
import type { GitLabInstance } from '../../types/gitlab.ts'
import { DashboardHeader } from '../DashboardHeader/DashboardHeader.tsx'
import { BarList } from '../BarList/BarList.tsx'
import { WorkingGroupChart } from '../WorkingGroupChart/WorkingGroupChart.tsx'
import { ArcsTable } from '../ArcTable/ArcTable.tsx'
import { ArcFilterBar } from '../ArcFilterBar/ArcFilterBar.tsx'
import { useDashboardConfiguration, type DashboardGroup } from './configuration.ts'
import { useDataHubs } from './hooks/useDataHubs.ts'
import { useGroups } from './hooks/useGroups.ts'
import { useProjectsPage } from './hooks/useProjectsPage.ts'
import { toArcSummary } from './logic/toArcSummary.ts'
import styles from './DataHubDashboard.module.css'

export interface DataHubDashboardProps {
  onArcClick: (url: string, name: string, projectId: number, dataHub: GitLabInstance) => void
  now?: () => Date
}

interface ProjectView {
  hubId: string
  group?: DashboardGroup
  repositories: 'all' | 'your' | 'mostStarred'
  query: string
  recentAfter?: string
  sort: SortState
  page: number
}

function DataHubDashboard({ onArcClick, now = () => new Date() }: DataHubDashboardProps) {
  const { dataHubs } = useDashboardConfiguration()
  const { accounts } = useAuthentication()
  const initialHub = dataHubs.find(hub => hub.id === defaultDataHub.id) ?? dataHubs[0]
  const [view, setView] = useState<ProjectView>(() => ({
    hubId: initialHub?.id ?? '', repositories: 'all', query: '', sort: { column: 'lastChange', direction: 'DESC' }, page: 1,
  }))
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchResetKey, setSearchResetKey] = useState(0)
  const { hubs, retry } = useDataHubs(refreshKey)
  const groups = useGroups(refreshKey)
  const projects = useProjectsPage({ hubId: view.hubId, groupId: view.group?.group.id }, {
    page: view.page, search: view.query,
    orderBy: view.repositories === 'mostStarred' ? 'star_count'
      : view.sort.column === 'title' ? 'name' : view.group ? 'last_activity_at' : 'updated_at',
    sort: view.repositories === 'mostStarred' ? 'desc' : view.sort.direction === 'ASC' ? 'asc' : 'desc',
    lastActivityAfter: view.recentAfter, membership: view.repositories === 'your' ? true : undefined,
  }, refreshKey)
  const current = now()
  const hubNames = useMemo(() => new Map(dataHubs.map(hub => [hub.id, hub.name])), [dataHubs])
  const token = accounts[view.hubId]?.session?.token
  const arcs = useMemo(() => {
    if (projects.status !== 'success' || !projects.hub) return []
    const names = new Map<string, string>()
    return projects.result.data.items.map(project => {
      const arc = toArcSummary(project, projects.hub!, names, !token || projects.result.tokenRejected)
      return { ...arc, group: { ...arc.group, label: project.namespace?.full_path ?? project.namespace?.name ?? arc.group.label } }
    })
  }, [projects.status, projects.result, projects.hub, token])
  const hubCounts = hubs.map(({ hub, data, status }) => ({
    key: hub.id, label: hub.name, count: data ?? null,
    loading: status === 'loading', capped: data !== undefined && data !== null && data >= PROJECT_COUNT_LIMIT,
  }))
  const updating = hubs.some(hub => hub.status === 'loading')
    || groups.all.hubs.some(hub => hub.status === 'loading')
    || groups.mine.hubs.some(hub => hub.status === 'loading') || projects.status === 'loading'
  const updatedAt = hubs.reduce<Date | null>((latest, hub) =>
    hub.updatedAt && (!latest || hub.updatedAt > latest) ? hub.updatedAt : latest, null)
  const loggedIn = dataHubs.some(hub => !!accounts[hub.id]?.session)
  const chips: { kind: FilterKind; label: string }[] = [{ kind: 'hub', label: 'DataHUB: ' + (hubNames.get(view.hubId) ?? view.hubId) }]
  if (view.group) chips.push({ kind: 'group', label: 'Group: ' + view.group.group.full_path })
  if (view.repositories !== 'all') chips.push({ kind: 'repositories',
    label: view.repositories === 'your' ? 'Your repositories' : 'Most Starred repositories' })
  if (view.query) chips.push({ kind: 'query', label: 'Search: “' + view.query + '”' })
  if (view.recentAfter) chips.push({ kind: 'recent', label: 'Active in the last 30 days' })
  const clearAll = () => {
    setView(previous => ({ ...previous, hubId: initialHub?.id ?? '', group: undefined, repositories: 'all',
      query: '', recentAfter: undefined, page: 1 }))
    setSearchResetKey(key => key + 1)
  }
  const removeChip = (kind: FilterKind) => {
    if (kind === 'query') setSearchResetKey(key => key + 1)
    setView(previous => ({ ...previous, page: 1,
      ...(kind === 'hub' ? { hubId: initialHub?.id ?? '', group: undefined } : {}),
      ...(kind === 'group' ? { group: undefined } : {}),
      ...(kind === 'query' ? { query: '' } : {}),
      ...(kind === 'recent' ? { recentAfter: undefined } : {}),
      ...(kind === 'repositories' ? { repositories: 'all' as const } : {}),
    }))
  }
  return <main className={styles.main}>
    <DashboardHeader hubCount={hubs.length} okCount={hubs.filter(hub => hub.status === 'loaded').length}
      updatedAt={updatedAt} now={current} onUpdate={() => setRefreshKey(key => key + 1)} updating={updating} />
    {hubs.filter(hub => hub.status === 'failed').map(({ hub, error }) =>
      <Banner key={hub.id} variant="warning" title={'Could not load the count for ' + hub.name} description={error}
        primaryAction={<Banner.PrimaryAction onClick={() => retry(hub.id)}>Retry {hub.name}</Banner.PrimaryAction>} />)}
    {projects.result?.tokenRejected && <Banner variant="warning" title={'Your login for ' + projects.hub?.name + ' has expired'}>
      Showing public ARCs only. Log in again to see private ARCs.
    </Banner>}
    <div className={styles.content}>
      <div className={styles.charts}>
        <BarList title="ARCs per DataHUB" items={hubCounts} max={hubCounts.length} activeKey={view.hubId}
          onToggle={hubId => setView(previous => ({ ...previous, hubId, group: undefined, page: 1 }))} />
        <WorkingGroupChart groups={groups} loggedIn={loggedIn} refreshKey={refreshKey} activeKey={view.group?.key}
          onSelect={group => setView(previous => ({ ...previous, hubId: group.hub.id,
            group: previous.group?.key === group.key ? undefined : group, repositories: 'all', recentAfter: undefined, page: 1 }))} />
      </div>
      <Stack>
        <div className={styles.repositoryFilters}>
          <span className={styles.repositoryLabel}>Repositories</span>
          <SegmentedControl aria-label="Repositories" size="small" onChange={index => setView(previous => ({ ...previous,
            repositories: (['all', 'your', 'mostStarred'] as const)[index], group: undefined,
            sort: { column: 'lastChange', direction: 'DESC' }, page: 1 }))}>
            <SegmentedControl.Button selected={view.repositories === 'all'}>All</SegmentedControl.Button>
            <SegmentedControl.Button selected={view.repositories === 'your'}>Your</SegmentedControl.Button>
            <SegmentedControl.Button selected={view.repositories === 'mostStarred'}>Most Starred</SegmentedControl.Button>
          </SegmentedControl>
          {view.group && <span className={styles.repositoryHint}>Choosing an option clears the organisation filter.</span>}
        </div>
        <ArcFilterBar key={searchResetKey} query={view.query}
          onSearch={query => setView(previous => ({ ...previous, query, page: 1 }))} recent={!!view.recentAfter}
          allowRecent={!view.group} onRecentToggle={() => setView(previous => ({ ...previous, page: 1,
            recentAfter: previous.recentAfter ? undefined : new Date(current.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() }))}
          chips={chips} onRemoveChip={removeChip} onClearAll={clearAll} shown={arcs.length}
          total={projects.result?.data.total ?? null} loading={projects.status === 'loading'} unavailable={projects.status === 'error'} />
        {projects.status === 'loading' && <section aria-label="ARCs" aria-busy="true" className={styles.placeholder}>
          <h2 className={styles.placeholderTitle}>ARCs</h2><p role="status">Loading ARCs…</p>
          <SkeletonBox width="100%" height="100px" />
        </section>}
        {projects.status === 'error' && <Banner variant="critical" title="Could not load ARCs" description={projects.error}
          primaryAction={<Banner.PrimaryAction onClick={projects.retry}>Retry ARCs</Banner.PrimaryAction>} />}
        {projects.status === 'success' && <ArcsTable arcs={arcs} hubNames={hubNames}
          sort={view.repositories === 'mostStarred' ? undefined : view.sort} now={current}
          pagination={projects.result.data} onPageChange={page => setView(previous => ({ ...previous, page }))}
          onSortChange={sort => setView(previous => ({ ...previous, sort, page: 1 }))}
          onClearFilters={view.group || view.repositories !== 'all' || view.query || view.recentAfter ? clearAll : undefined}
          onOpen={arc => onArcClick(arc.url, arc.title, arc.projectId, projects.hub!)} />}
        {!initialHub && <p>No DataHUBs configured.</p>}
      </Stack>
    </div>
  </main>
}

export default DataHubDashboard
