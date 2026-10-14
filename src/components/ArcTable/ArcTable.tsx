import { useState } from 'react'
import { Stack, ActionList, ActionMenu, Button, ButtonGroup, IconButton, Label, Link, Tooltip } from '@primer/react'
import { DataTable, SkeletonBox, Table, type Column } from '@primer/react/experimental'
import { GlobeIcon, LinkExternalIcon, LockIcon, TriangleDownIcon } from '@primer/octicons-react'
import type { ArcSummary, DetailsMap, SortState } from '../../types/dashboard.ts'
import { initials } from '../DataHubDashboard/logic/people.ts'
import { relativeTime } from '../../util/time.ts'
import styles from './ArcTable.module.css'

export interface ArcTableProps {
  /** Already filtered and sorted. */
  arcs: ArcSummary[]
  hubNames: Map<string, string>
  sort: SortState
  onSortChange: (sort: SortState) => void
  now: Date
  onOpen: (arc: ArcSummary) => void
  /** Changing this returns the table to its first page. */
  resetKey?: string
  /** Offered in the empty state; pass it only while filters are active. */
  onClearFilters?: () => void
  /** Contributor details, one entry per ARC key once loaded. */
  details?: DetailsMap
}

const PAGE_SIZE = 25
const SORT_COLUMNS: SortState['column'][] = ['title', 'hub', 'lastChange']

const AVATAR_COLORS = [
  'var(--bgColor-accent-emphasis)',
  'var(--bgColor-success-emphasis)',
  'var(--bgColor-attention-emphasis)',
  'var(--bgColor-danger-emphasis)',
  'var(--bgColor-severe-emphasis)',
  'var(--bgColor-done-emphasis)',
]

function colorFor(id: string) {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

type Row = ArcSummary & { id: string }

export function ArcsTable({ arcs, hubNames, sort, onSortChange, now, onOpen, resetKey = '', onClearFilters, details }: ArcTableProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPageIndex(0)
  }
  // A shrinking list (e.g. after a reload with fewer ARCs) must not strand the table past its last page.
  const maxPage = Math.max(0, Math.ceil(arcs.length / PAGE_SIZE) - 1)
  if (pageIndex > maxPage) setPageIndex(maxPage)

  const peopleCell = (arc: Row) => {
    const entry = details?.get(arc.key)
    if (entry === undefined) return <SkeletonBox height={20} width={64} delay="short" className={styles.skeleton} />
    if (entry === 'unavailable' || entry.people.length === 0) return <span className={styles.muted}>—</span>
    const shown = entry.people.slice(0, 3)
    const extra = entry.people.length - shown.length
    return (
      <div className={styles.people}>
        {shown.map(person => (
          <Tooltip text={person.name} type="label" direction="s" key={person.id}>
            <button type="button" className={styles.avatar} style={{ background: colorFor(person.id) }}>{initials(person.name)}</button>
          </Tooltip>
        ))}
        {extra > 0 && <span className={styles.morePill}>+{extra}</span>}
      </div>
    )
  }

  const rows: Row[] = arcs.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).map(arc => ({ ...arc, id: arc.key }))
  const columns: Column<Row>[] = [
    {
      id: 'title', header: 'Title', sortBy: true, rowHeader: true, width: 'grow',
      renderCell: arc => (
        <Stack gap="condensed">
          <span>
            <Link className={styles.titleLink} href={arc.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${arc.title} on ${hubNames.get(arc.hubId) ?? arc.hubId}`}>{arc.title} <LinkExternalIcon size={14} /></Link>
          </span>
          <span className={styles.group}>{arc.group.label}</span>
        </Stack>
      ),
    },
    { id: 'hub', header: 'DataHUB', sortBy: true, width: 'auto', renderCell: arc => hubNames.get(arc.hubId) ?? arc.hubId },
    {
      id: 'access', header: 'Access', width: 'auto',
      renderCell: arc => arc.access === 'public'
        ? <Label variant="success"><GlobeIcon size={12} /> Public</Label>
        : <Label variant="attention"><LockIcon size={12} /> Private</Label>,
    },
    { id: 'people', header: 'People', width: 'auto', renderCell: peopleCell },
    {
      id: 'lastChange', header: 'Last change', sortBy: true, width: 'auto',
      renderCell: arc => {
        const entry = details?.get(arc.key)
        const by = entry !== undefined && entry !== 'unavailable' ? entry.lastChangeBy : null
        return <div className={styles.changed}>{relativeTime(arc.lastActivityAt, now)}{by && <span className={styles.by}>by {by}</span>}</div>
      },
    },
    {
      id: 'open', header: () => <span className={styles.hidden}>Open</span>, width: 'auto', align: 'end',
      renderCell: arc => (
        <ButtonGroup>
          <Button size="small" aria-label={`Open ${arc.title}`} onClick={() => onOpen(arc)}>Open</Button>
          <ActionMenu>
            <ActionMenu.Anchor>
              <IconButton icon={TriangleDownIcon} size="small" variant="invisible" aria-label={`More actions for ${arc.title}`} />
            </ActionMenu.Anchor>
            <ActionMenu.Overlay>
              <ActionList>
                <ActionList.LinkItem href={arc.url} target="_blank" rel="noopener noreferrer">View on {hubNames.get(arc.hubId) ?? arc.hubId}</ActionList.LinkItem>
                <ActionList.Item onSelect={() => void navigator.clipboard.writeText(arc.url)}>Copy link</ActionList.Item>
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        </ButtonGroup>
      ),
    },
  ]

  if (arcs.length === 0) {
    return (
      <div className={`${styles.container} ${styles.empty}`}>
        <p className={styles.message}>{onClearFilters ? 'No ARCs match these filters.' : 'No ARCs to show.'}</p>
        {onClearFilters && <Button variant="invisible" onClick={onClearFilters}>Clear filters</Button>}
      </div>
    )
  }

  return (
    <Table.Container>
      <Table.Title as="h2" id="arc-table-title" className={styles.hidden}>ARCs</Table.Title>
      <DataTable
        aria-labelledby="arc-table-title"
        data={rows}
        columns={columns}
        externalSorting
        initialSortColumn={sort.column}
        initialSortDirection={sort.direction}
        onToggleSort={(column, direction) => {
          if (SORT_COLUMNS.includes(column as SortState['column'])) onSortChange({ column: column as SortState['column'], direction })
        }} />
      <Table.Pagination key={resetKey} aria-label="ARC pages" pageSize={PAGE_SIZE} totalCount={arcs.length}
        onChange={({ pageIndex }) => setPageIndex(pageIndex)} />
    </Table.Container>
  )
}

export { ArcsTable as ArcTable }
