import { useState, type ReactNode } from 'react'
import { HistoryIcon, SearchIcon, XIcon } from '@primer/octicons-react'
import { Button, IconButton, SkeletonBox, TextInput, Token } from '@primer/react'
import type { FilterKind } from '../../types/dashboard.ts'
import styles from './ArcFilterBar.module.css'

export interface ArcFilterBarProps {
  query: string
  onSearch: (query: string) => void
  recent: boolean
  onRecentToggle: () => void
  chips: { kind: FilterKind; label: string }[]
  onRemoveChip: (kind: FilterKind) => void
  onClearAll: () => void
  shown: number
  total: number
  loading?: boolean
  unavailable?: boolean
  /** Slot for the "More columns" menu. */
  moreColumns?: ReactNode
}

export function ArcFilterBar({
  query, onSearch, recent, onRecentToggle, chips, onRemoveChip, onClearAll, shown, total, loading, unavailable, moreColumns,
}: ArcFilterBarProps) {
  const [queryInput, setQueryInput] = useState(query)
  return (
    <div className={styles.bar}>
      <form className={styles.search} role="search" aria-label="Search ARCs"
        onSubmit={event => { event.preventDefault(); onSearch(queryInput.trim()) }}>
        <TextInput className={styles.input} type="search" aria-label="Search ARCs" leadingVisual={SearchIcon}
          placeholder="Search ARCs by title, group, topic, person…" value={queryInput}
          onChange={event => setQueryInput(event.target.value)} />
        <Button type="submit" variant="primary">Search</Button>
        <IconButton type="button" icon={HistoryIcon} size="small" variant="invisible" aria-label="Only recently changed ARCs"
          aria-pressed={recent} onClick={onRecentToggle} />
        {moreColumns}
      </form>
      <div className={styles.filters}>
        <span className={styles.label}>Filters:</span>
        {chips.length === 0 && <span className={styles.hint}>No filters. Click a card, a bar, or search to narrow down.</span>}
        {chips.map(chip => (
          <span key={chip.kind} className={styles.chip}>
            {/* Primer's own remove button is always named "Remove token", so it is replaced by a named one. */}
            <Token text={chip.label} hideRemoveButton />
            <IconButton icon={XIcon} size="small" variant="invisible" aria-label={`Remove filter ${chip.label}`}
              onClick={() => onRemoveChip(chip.kind)} />
          </span>
        ))}
        {chips.length >= 2 && <Button variant="invisible" size="small" onClick={onClearAll}>Clear all</Button>}
        <span role="status" className={styles.count} aria-label={loading ? 'Loading ARC results' : undefined}>
          {loading ? <SkeletonBox height="16px" width="140px" /> : unavailable ? 'ARC count unavailable'
            : <>Showing <strong>{shown}</strong> of {total} ARCs</>}
        </span>
      </div>
    </div>
  )
}
