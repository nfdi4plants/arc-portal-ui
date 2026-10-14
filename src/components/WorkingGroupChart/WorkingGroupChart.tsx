import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, IconButton, SkeletonBox, TextInput } from '@primer/react'
import { SearchIcon, StarFillIcon, StarIcon } from '@primer/octicons-react'
import { UnderlinePanels } from '@primer/react/experimental'
import { PROJECT_COUNT_LIMIT } from '../../api/gitlab/projectCount.ts'
import type { DashboardGroup } from '../DataHubDashboard/configuration.ts'
import { useFavoriteGroups } from '../DataHubDashboard/hooks/useFavoriteGroups.ts'
import { useGroupProjectCount } from '../DataHubDashboard/hooks/useGroupProjectCount.ts'
import type { useGroups } from '../DataHubDashboard/hooks/useGroups.ts'
import styles from './WorkingGroupChart.module.css'

export interface WorkingGroupChartProps {
  groups: ReturnType<typeof useGroups>
  loggedIn: boolean
  refreshKey: number
  activeKey?: string
  onSelect: (group: DashboardGroup) => void
}

function GroupLabel({ item, active, onSelect }: { item: DashboardGroup; active: boolean; onSelect: () => void }) {
  return <button type="button" className={styles.select} aria-pressed={active}
    aria-label={'Browse ' + item.group.full_path + ' on ' + item.hub.name} onClick={onSelect}>
    <strong>{item.group.name}</strong>
    <span>{item.group.full_path} · {item.hub.name}</span>
  </button>
}

function FavoriteButton({ item, favorite, onToggle }: { item: DashboardGroup; favorite: boolean; onToggle: () => void }) {
  return <IconButton icon={favorite ? StarFillIcon : StarIcon} variant="invisible" size="small"
    aria-label={(favorite ? 'Unfavorite ' : 'Favorite ') + item.group.full_path + ' on ' + item.hub.name}
    aria-pressed={favorite} onClick={onToggle} />
}

function MyGroupBar({ item, hidden, favorite, active, onSelect, onFavorite, refreshKey, maxCount, onCount }: {
  item: DashboardGroup; hidden: boolean; favorite: boolean; active: boolean; onSelect: () => void; onFavorite: () => void
  refreshKey: number; maxCount: number; onCount: (key: string, count: number | null) => void
}) {
  const result = useGroupProjectCount(item.hub.id, item.group.id, refreshKey)
  const count = result.result?.data ?? null
  const loading = result.status === 'loading'
  useEffect(() => { onCount(item.key, count) }, [item.key, count, onCount])
  return <li className={styles.item} hidden={hidden} data-group-key={item.key}>
    <div className={styles.row}>
      <GroupLabel item={item} active={active} onSelect={onSelect} />
      <FavoriteButton item={item} favorite={favorite} onToggle={onFavorite} />
    </div>
    <div className={styles.countRow} aria-busy={loading || undefined}
      aria-label={item.group.full_path + ': ' + (loading ? 'Loading count' : count === null ? 'Count unavailable'
        : count.toLocaleString('en-US') + (count >= PROJECT_COUNT_LIMIT ? '+' : '') + ' repositories')}>
      <span className={styles.track} aria-hidden="true">
        {loading ? <SkeletonBox width="100%" height="8px" /> : <span
          className={count !== null && count >= PROJECT_COUNT_LIMIT ? styles.capped : styles.bar}
          style={{ width: ((count ?? 0) / maxCount * 100) + '%' }} />}
      </span>
      <span>{loading ? <SkeletonBox width="40px" height="16px" /> : count === null ? '–'
        : count.toLocaleString('en-US') + (count >= PROJECT_COUNT_LIMIT ? '+' : '')}</span>
    </div>
    {result.status === 'error' && <div className={styles.error}>
      Count unavailable. <Button size="small" variant="invisible" onClick={result.retry}
        aria-label={'Retry count for ' + item.group.full_path + ' on ' + item.hub.name}>Retry</Button>
    </div>}
  </li>
}

export function WorkingGroupChart({ groups, loggedIn, refreshKey, activeKey, onSelect }: WorkingGroupChartProps) {
  const [tab, setTab] = useState(loggedIn ? 'my' : 'all')
  const [lastLoggedIn, setLastLoggedIn] = useState(loggedIn)
  const [visitedMine, setVisitedMine] = useState(loggedIn)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [counts, setCounts] = useState(new Map<string, number>())
  const { favorites, toggleFavorite } = useFavoriteGroups()
  if (loggedIn !== lastLoggedIn) {
    setLastLoggedIn(loggedIn)
    setTab(loggedIn ? 'my' : 'all')
    setVisitedMine(loggedIn)
  }
  const onCount = useCallback((key: string, count: number | null) => setCounts(previous => {
    if ((previous.get(key) ?? null) === count) return previous
    const next = new Map(previous)
    if (count === null) next.delete(key)
    else next.set(key, count)
    return next
  }), [])
  const ordered = useMemo(() => {
    const compare = (a: DashboardGroup, b: DashboardGroup) =>
      Number(favorites.has(b.key)) - Number(favorites.has(a.key))
      || a.group.name.localeCompare(b.group.name, undefined, { sensitivity: 'base' })
      || a.group.full_path.localeCompare(b.group.full_path) || a.hub.name.localeCompare(b.hub.name)
    return { all: [...groups.allGroups].sort(compare), mine: [...groups.myGroups].sort(compare) }
  }, [groups.allGroups, groups.myGroups, favorites])
  const needle = query.trim().toLowerCase()
  const matches = (item: DashboardGroup) => [item.group.name, item.group.full_path, item.hub.name]
    .some(value => value.toLowerCase().includes(needle))
  const allMatches = ordered.all.filter(matches)
  const maxPage = Math.max(0, Math.ceil(allMatches.length / 25) - 1)
  if (page > maxPage) setPage(maxPage)
  const maxCount = Math.max(1, ...ordered.mine.map(item => counts.get(item.key) ?? 0))
  const resource = tab === 'my' ? groups.mine : groups.all
  return <section aria-label="Groups" className={styles.panel}>
    <h2 className={styles.title}>Groups</h2>
    <TextInput type="search" aria-label="Search groups" placeholder="Search groups…" leadingVisual={SearchIcon}
      value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} />
    <UnderlinePanels aria-label="Group lists" value={tab} onChange={({ value }) => {
      setTab(value)
      if (value === 'my' && loggedIn) setVisitedMine(true)
    }}>
      <UnderlinePanels.Tab value="my">My groups</UnderlinePanels.Tab>
      <UnderlinePanels.Tab value="all">All groups</UnderlinePanels.Tab>
      <UnderlinePanels.Panel value="my" className={styles.tabPanel}>
        {!loggedIn ? <p className={styles.error}>Log in to see your groups.</p> : <>
          <ul className={styles.list}>
            {visitedMine && ordered.mine.map(item => <MyGroupBar key={item.key} item={item} hidden={!matches(item)}
              favorite={favorites.has(item.key)} active={activeKey === item.key} onSelect={() => onSelect(item)}
              onFavorite={() => toggleFavorite(item.key)} refreshKey={refreshKey} maxCount={maxCount} onCount={onCount} />)}
          </ul>
          {!ordered.mine.some(matches) && !groups.mine.hubs.some(hub => hub.status === 'loading') &&
            <p className={styles.error}>{needle ? 'No groups match your search.' : 'No member groups found.'}</p>}
        </>}
      </UnderlinePanels.Panel>
      <UnderlinePanels.Panel value="all" className={styles.tabPanel}>
        <ul className={styles.list}>
          {allMatches.slice(page * 25, (page + 1) * 25).map(item => <li key={item.key}
            className={styles.item} data-group-key={item.key}>
            <div className={styles.row}>
              <GroupLabel item={item} active={activeKey === item.key} onSelect={() => onSelect(item)} />
              <FavoriteButton item={item} favorite={favorites.has(item.key)} onToggle={() => { toggleFavorite(item.key); setPage(0) }} />
            </div>
          </li>)}
        </ul>
        {allMatches.length === 0 && !groups.all.hubs.some(hub => hub.status === 'loading') &&
          <p className={styles.error}>{needle ? 'No groups match your search.' : 'No groups found.'}</p>}
        {allMatches.length > 25 && <nav aria-label="Group pages" className={styles.pagination}>
          <Button size="small" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous groups</Button>
          <span>Page {page + 1}</span>
          <Button size="small" disabled={page === maxPage} onClick={() => setPage(value => value + 1)}>Next groups</Button>
        </nav>}
      </UnderlinePanels.Panel>
    </UnderlinePanels>
    {resource.hubs.some(hub => hub.status === 'loading') && <p role="status">Loading groups…</p>}
    {resource.hubs.filter(hub => hub.status === 'failed').map(({ hub, error }) =>
      <div key={hub.id} role="alert" className={styles.error}>
        Could not load {tab === 'my' ? 'your groups' : 'groups'} for {hub.name}. {error}
        <Button size="small" variant="invisible" onClick={() => resource.retry(hub.id)}>Retry groups for {hub.name}</Button>
      </div>)}
  </section>
}
