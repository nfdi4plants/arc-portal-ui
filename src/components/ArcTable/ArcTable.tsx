import { useId } from 'react'
import { Stack, ActionList, ActionMenu, Button, ButtonGroup, IconButton, Label, Link } from '@primer/react'
import { DataTable, Table, type Column } from '@primer/react/experimental'
import { GlobeIcon, LinkExternalIcon, LockIcon, TriangleDownIcon } from '@primer/octicons-react'
import type { ArcSummary, SortState } from '../../types/dashboard.ts'
import type { GitLabPage, GitLabProject } from '../../types/gitlab.ts'
import { relativeTime } from '../../util/time.ts'
import styles from './ArcTable.module.css'

export interface ArcTableProps {
  arcs: ArcSummary[]
  hubNames: Map<string, string>
  sort: SortState
  onSortChange: (sort: SortState) => void
  now: Date
  onOpen: (arc: ArcSummary) => void
  onClearFilters?: () => void
  pagination: GitLabPage<GitLabProject>
  onPageChange: (page: number) => void
}

type Row = ArcSummary & { id: string }

export function ArcsTable({ arcs, hubNames, sort, onSortChange, now, onOpen, onClearFilters, pagination, onPageChange }: ArcTableProps) {
  const headingId = useId()
  const rows: Row[] = arcs.map(arc => ({ ...arc, id: arc.key }))
  const columns: Column<Row>[] = [
    {
      id: 'title', header: 'Title', sortBy: true, rowHeader: true, width: 'grow',
      renderCell: arc => <Stack gap="condensed">
        <Link className={styles.titleLink} href={arc.url} target="_blank" rel="noopener noreferrer"
          aria-label={'View ' + arc.title + ' on ' + (hubNames.get(arc.hubId) ?? arc.hubId)}>
          {arc.title} <LinkExternalIcon size={14} />
        </Link>
        <span className={styles.group}>{arc.group.label}</span>
      </Stack>,
    },
    { id: 'hub', header: 'DataHUB', width: 'auto', renderCell: arc => hubNames.get(arc.hubId) ?? arc.hubId },
    { id: 'access', header: 'Access', width: 'auto', renderCell: arc => arc.access === 'public'
      ? <Label variant="success"><GlobeIcon size={12} /> Public</Label>
      : <Label variant="attention"><LockIcon size={12} /> Private</Label> },
    { id: 'lastChange', header: 'Last activity', sortBy: true, width: 'auto',
      renderCell: arc => relativeTime(arc.lastActivityAt, now) },
    { id: 'open', header: () => <span className={styles.hidden}>Open</span>, width: 'auto', align: 'end',
      renderCell: arc => <ButtonGroup>
        <Button size="small" aria-label={'Open ' + arc.title} onClick={() => onOpen(arc)}>Open</Button>
        <ActionMenu>
          <ActionMenu.Anchor><IconButton icon={TriangleDownIcon} size="small" variant="invisible"
            aria-label={'More actions for ' + arc.title} /></ActionMenu.Anchor>
          <ActionMenu.Overlay><ActionList>
            <ActionList.LinkItem href={arc.url} target="_blank" rel="noopener noreferrer">
              View on {hubNames.get(arc.hubId) ?? arc.hubId}
            </ActionList.LinkItem>
            <ActionList.Item onSelect={() => void navigator.clipboard.writeText(arc.url)}>Copy link</ActionList.Item>
          </ActionList></ActionMenu.Overlay>
        </ActionMenu>
      </ButtonGroup> },
  ]
  return <section aria-label="ARCs">
    <h2 id={headingId} className={styles.hidden}>ARCs</h2>
    {arcs.length === 0 ? <div className={styles.empty}>
      <p>{onClearFilters ? 'No ARCs match these filters.' : 'No ARCs to show.'}</p>
      {onClearFilters && <Button variant="invisible" onClick={onClearFilters}>Clear filters</Button>}
    </div> : <Table.Container>
      <DataTable key={sort.column + sort.direction} aria-labelledby={headingId} data={rows} columns={columns}
        externalSorting initialSortColumn={sort.column} initialSortDirection={sort.direction}
        onToggleSort={(column, direction) => {
          if (column === 'title' || column === 'lastChange') onSortChange({ column, direction })
        }} />
    </Table.Container>}
    <nav aria-label="ARC pages" className={styles.pagination}>
      <Button disabled={pagination.previousPage === null} onClick={() => onPageChange(pagination.previousPage!)}>Previous</Button>
      <span>Page {pagination.page}</span>
      <Button disabled={pagination.nextPage === null} onClick={() => onPageChange(pagination.nextPage!)}>Next</Button>
    </nav>
  </section>
}
