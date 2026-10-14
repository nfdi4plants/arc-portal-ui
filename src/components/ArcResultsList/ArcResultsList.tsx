import { useId } from 'react'
import { ActionList, ActionMenu, Button, IconButton, Label, Pagination, Select } from '@primer/react'
import { GlobeIcon, KebabHorizontalIcon, LinkExternalIcon, LockIcon, StarIcon } from '@primer/octicons-react'
import type { ArcSummary, SortState } from '../../types/dashboard.ts'
import type { GitLabPage, GitLabProject } from '../../types/gitlab.ts'
import { relativeTime } from '../../util/time.ts'
import styles from './ArcResultsList.module.css'

export interface ArcResultsListProps {
  arcs: ArcSummary[]
  hubNames: Map<string, string>
  sort?: SortState
  onSortChange: (sort: SortState) => void
  now: Date
  onOpen: (arc: ArcSummary) => void
  onClearFilters?: () => void
  pagination: GitLabPage<GitLabProject>
  onPageChange: (page: number) => void
}

const sortOptions: { label: string; value: string; sort: SortState }[] = [
  { label: 'Last activity: newest first', value: 'lastChange-DESC', sort: { column: 'lastChange', direction: 'DESC' } },
  { label: 'Last activity: oldest first', value: 'lastChange-ASC', sort: { column: 'lastChange', direction: 'ASC' } },
  { label: 'Title: A–Z', value: 'title-ASC', sort: { column: 'title', direction: 'ASC' } },
  { label: 'Title: Z–A', value: 'title-DESC', sort: { column: 'title', direction: 'DESC' } },
]

export function ArcResultsList({ arcs, hubNames, sort, onSortChange, now, onOpen, onClearFilters, pagination, onPageChange }: ArcResultsListProps) {
  const headingId = useId()
  const sortId = useId()
  const totalPages = pagination.totalPages ?? (pagination.total === null ? null : Math.ceil(pagination.total / pagination.perPage))
  // Without a total, expose only Previous/Next using the server's page metadata.
  const pageCount = Math.max(1, totalPages ?? pagination.nextPage ?? pagination.page)

  return <section aria-label="ARCs" className={styles.panel}>
    <div className={styles.header}>
      <h2 id={headingId} className={styles.heading}>ARCs</h2>
      {sort ? <div className={styles.sort}>
        <label htmlFor={sortId}>Sort by</label>
        <Select id={sortId} size="small" value={sort.column + '-' + sort.direction} onChange={event => {
          const option = sortOptions.find(option => option.value === event.target.value)
          if (option) onSortChange(option.sort)
        }}>
          {sortOptions.map(option => <Select.Option key={option.value} value={option.value}>{option.label}</Select.Option>)}
        </Select>
      </div> : <span className={styles.muted}>Sorted by most starred</span>}
    </div>
    {arcs.length === 0 ? <div className={styles.empty}>
      <p>{onClearFilters ? 'No ARCs match these filters.' : 'No ARCs to show.'}</p>
      {onClearFilters && <Button variant="invisible" onClick={onClearFilters}>Clear filters</Button>}
    </div> : <ul aria-labelledby={headingId} className={styles.list}>
      {arcs.map(arc => <li key={arc.key} className={styles.item}>
        <button type="button" className={styles.open} aria-label={'Open ' + arc.title} onClick={() => onOpen(arc)}>
          <span className={styles.title}>{arc.title}</span>
          <span className={styles.namespace}>{arc.group.label}</span>
          {arc.description.trim() && <span className={styles.description}>{arc.description}</span>}
          <span className={styles.metadata}>
            {arc.access === 'public'
              ? <Label variant="success" className={styles.access}><GlobeIcon size={12} /> Public</Label>
              : <Label variant="attention" className={styles.access}><LockIcon size={12} /> Private</Label>}
            <span>{hubNames.get(arc.hubId) ?? arc.hubId}</span>
            <span>Last activity {relativeTime(arc.lastActivityAt, now)}</span>
            <span className={styles.stars} aria-label={arc.stars + ' stars'}><StarIcon size={14} /> {arc.stars}</span>
          </span>
        </button>
        <div className={styles.actions}>
          <ActionMenu>
            <ActionMenu.Anchor><IconButton icon={KebabHorizontalIcon} size="small" variant="invisible"
              aria-label={'More actions for ' + arc.title} /></ActionMenu.Anchor>
            <ActionMenu.Overlay><ActionList>
              <ActionList.LinkItem href={arc.url} target="_blank" rel="noopener noreferrer">
                <ActionList.LeadingVisual><LinkExternalIcon /></ActionList.LeadingVisual>
                View on {hubNames.get(arc.hubId) ?? arc.hubId}
              </ActionList.LinkItem>
              <ActionList.Item onSelect={() => void navigator.clipboard.writeText(arc.url)}>Copy link</ActionList.Item>
            </ActionList></ActionMenu.Overlay>
          </ActionMenu>
        </div>
      </li>)}
    </ul>}
    <div className={styles.footer}>
      <span className={styles.muted}>Page {pagination.page}{totalPages === null ? '' : ' of ' + pageCount}</span>
      <Pagination aria-label="ARC pages" className={styles.pagination} pageCount={pageCount} currentPage={pagination.page}
        showPages={totalPages === null ? false : { narrow: false, regular: true, wide: true }} surroundingPageCount={1}
        onPageChange={(event, page) => { event.preventDefault(); onPageChange(page) }} />
    </div>
  </section>
}
