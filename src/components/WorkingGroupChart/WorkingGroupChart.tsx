import { useMemo, useState } from 'react'
import { Button, CounterLabel, IconButton, Pagination, Select, TextInput } from '@primer/react'
import { SearchIcon, StarFillIcon, StarIcon } from '@primer/octicons-react'
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

function MyGroupRow({ item, hidden, favorite, active, onSelect, onFavorite, refreshKey }: {
  item: DashboardGroup; hidden: boolean; favorite: boolean; active: boolean; onSelect: () => void; onFavorite: () => void
  refreshKey: number
}) {
  const result = useGroupProjectCount(item.hub.id, item.group.id, refreshKey)
  const count = result.result?.data ?? null
  const loading = result.status === 'loading'
  return <li className={styles.item} hidden={hidden} data-group-key={item.key}>
    <div className={styles.row}>
      <GroupLabel item={item} active={active} onSelect={onSelect} />
      <span className={styles.count} aria-busy={loading || undefined}
        aria-label={item.group.full_path + ': ' + (loading ? 'Loading count' : count === null ? 'Count unavailable'
          : count.toLocaleString('en-US') + (count >= PROJECT_COUNT_LIMIT ? '+' : '') + ' repositories')}>
        <CounterLabel>{loading ? '…' : count === null ? '–'
          : count.toLocaleString('en-US') + (count >= PROJECT_COUNT_LIMIT ? '+' : '')}</CounterLabel>
      </span>
      <FavoriteButton item={item} favorite={favorite} onToggle={onFavorite} />
    </div>
    {result.status === 'error' && <div className={styles.error}>
      Count unavailable. <Button size="small" variant="invisible" onClick={result.retry}
        aria-label={'Retry count for ' + item.group.full_path + ' on ' + item.hub.name}>Retry</Button>
    </div>}
  </li>
}

export function WorkingGroupChart({ groups, loggedIn, refreshKey, activeKey, onSelect }: WorkingGroupChartProps) {
  const [list, setList] = useState<'my' | 'all'>(loggedIn ? 'my' : 'all')
  const [lastLoggedIn, setLastLoggedIn] = useState(loggedIn)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const { favorites, toggleFavorite } = useFavoriteGroups()
  if (loggedIn !== lastLoggedIn) {
    setLastLoggedIn(loggedIn)
    setList(loggedIn ? 'my' : 'all')
  }
  const ordered = useMemo(() => {
    const favoritesFirst = (items: DashboardGroup[]) => [
      ...items.filter(item => favorites.has(item.key)), ...items.filter(item => !favorites.has(item.key)),
    ]
    return { all: favoritesFirst(groups.allGroups), mine: favoritesFirst(groups.myGroups) }
  }, [groups.allGroups, groups.myGroups, favorites])
  const needle = query.trim().toLowerCase()
  const matches = (item: DashboardGroup) => [item.group.name, item.group.full_path, item.hub.name]
    .some(value => value.toLowerCase().includes(needle))
  const allMatches = ordered.all.filter(matches)
  const maxPage = Math.max(0, Math.ceil(allMatches.length / 25) - 1)
  if (page > maxPage) setPage(maxPage)
  const resource = list === 'my' ? groups.mine : groups.all
  return <section aria-label="Groups" className={styles.panel}>
    <div className={styles.header}>
      <h2 className={styles.title}>Groups</h2>
      <Select aria-label="Group lists" size="small" value={list}
        onChange={event => setList(event.target.value === 'my' ? 'my' : 'all')}>
        <Select.Option value="my">My groups</Select.Option>
        <Select.Option value="all">All groups</Select.Option>
      </Select>
    </div>
    <TextInput type="search" aria-label="Search groups" placeholder="Search groups…" leadingVisual={SearchIcon}
      value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} />
    <div hidden={list !== 'my'}>
      {!loggedIn ? <p className={styles.error}>Log in to see your groups.</p> : <>
        <ul aria-label="My groups" className={styles.list}>
          {ordered.mine.map(item => <MyGroupRow key={item.key} item={item} hidden={!matches(item)}
            favorite={favorites.has(item.key)} active={activeKey === item.key} onSelect={() => onSelect(item)}
            onFavorite={() => toggleFavorite(item.key)} refreshKey={refreshKey} />)}
        </ul>
        {!ordered.mine.some(matches) && !groups.mine.hubs.some(hub => hub.status === 'loading') &&
          <p className={styles.error}>{needle ? 'No groups match your search.' : 'No member groups found.'}</p>}
      </>}
    </div>
    <div hidden={list !== 'all'}>
      <ul aria-label="All groups" className={styles.list}>
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
      {allMatches.length > 25 && <Pagination aria-label="Group pages" className={styles.pagination}
        pageCount={maxPage + 1} currentPage={page + 1} surroundingPageCount={1}
        onPageChange={(event, nextPage) => { event.preventDefault(); setPage(nextPage - 1) }} />}
    </div>
    {resource.hubs.some(hub => hub.status === 'loading') && <p role="status">Loading groups…</p>}
    {resource.hubs.filter(hub => hub.status === 'failed').map(({ hub, error }) =>
      <div key={hub.id} role="alert" className={styles.error}>
        Could not load {list === 'my' ? 'your groups' : 'groups'} for {hub.name}. {error}
        <Button size="small" variant="invisible" onClick={() => resource.retry(hub.id)}>Retry groups for {hub.name}</Button>
      </div>)}
  </section>
}
