import { useState } from 'react'
import { ActionList, ActionMenu, Button, ButtonGroup, IconButton, Label, Link } from '@primer/react'
import { DataTable, Table, type Column } from '@primer/react/experimental'
import { GlobeIcon, LinkExternalIcon, LockIcon, TriangleDownIcon } from '@primer/octicons-react'
import type { ArcSummary, SortState } from '../../types/dashboard.ts'
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
}

const PAGE_SIZE = 25
const SORT_COLUMNS: SortState['column'][] = ['title', 'hub', 'lastChange']

type Row = ArcSummary & { id: string }

export function ArcTable({ arcs, hubNames, sort, onSortChange, now, onOpen, resetKey = '', onClearFilters }: ArcTableProps) {
  const [pageIndex, setPageIndex] = useState(0)
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPageIndex(0)
  }
  // A shrinking list (e.g. after a reload with fewer ARCs) must not strand the table past its last page.
  const maxPage = Math.max(0, Math.ceil(arcs.length / PAGE_SIZE) - 1)
  if (pageIndex > maxPage) setPageIndex(maxPage)

  const rows: Row[] = arcs.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE).map(arc => ({ ...arc, id: arc.key }))
  const columns: Column<Row>[] = [
    {
      id: 'title', header: 'Title', sortBy: true, rowHeader: true, width: 'grow',
      renderCell: arc => (
        <div className={styles.title}>
          <Link as="button" className={styles.titleLink} onClick={() => onOpen(arc)}>{arc.title}</Link>
          <Link href={arc.url} target="_blank" rel="noopener noreferrer" aria-label={`View ${arc.title} on ${hubNames.get(arc.hubId) ?? arc.hubId}`}>
            <LinkExternalIcon size={14} />
          </Link>
          <span className={styles.group}>{arc.group.label}</span>
        </div>
      ),
    },
    { id: 'hub', header: 'DataHUB', sortBy: true, width: 'auto', renderCell: arc => hubNames.get(arc.hubId) ?? arc.hubId },
    {
      id: 'access', header: 'Access', width: 'auto',
      renderCell: arc => arc.access === 'public'
        ? <Label variant="success"><GlobeIcon size={12} /> Public</Label>
        : <Label variant="attention"><LockIcon size={12} /> Private</Label>,
    },
    { id: 'people', header: 'People', width: 'auto', renderCell: () => '—' },
    { id: 'lastChange', header: 'Last change', sortBy: true, width: 'auto', renderCell: arc => relativeTime(arc.lastActivityAt, now) },
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
    <Table.Container className={styles.container}>
      <Table.Title as="h2" id="arc-table-title" className={styles.hidden}>ARCs</Table.Title>
      <div className={styles.scroll}>
        <DataTable aria-labelledby="arc-table-title" data={rows} columns={columns} externalSorting
          initialSortColumn={sort.column} initialSortDirection={sort.direction}
          onToggleSort={(column, direction) => {
            if (SORT_COLUMNS.includes(column as SortState['column'])) onSortChange({ column: column as SortState['column'], direction })
          }} />
      </div>
      <Table.Pagination key={resetKey} aria-label="ARC pages" pageSize={PAGE_SIZE} totalCount={arcs.length}
        onChange={({ pageIndex }) => setPageIndex(pageIndex)} />
    </Table.Container>
  )
}