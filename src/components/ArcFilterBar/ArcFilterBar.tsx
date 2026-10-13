import type { ReactNode } from 'react'
import { HistoryIcon, SearchIcon, XIcon } from '@primer/octicons-react'
import { Button, IconButton, TextInput, Token } from '@primer/react'
import type { FilterKind } from '../../types/dashboard.ts'
import styles from './ArcFilterBar.module.css'

export interface ArcFilterBarProps {
  query: string
  onQueryChange: (query: string) => void
  recent: boolean
  onRecentToggle: () => void
  chips: { kind: FilterKind; label: string }[]
  onRemoveChip: (kind: FilterKind) => void
  onClearAll: () => void
  shown: number
  total: number
  /** Slot for the "More columns" menu. */
  moreColumns?: ReactNode
}

export function ArcFilterBar({
  query, onQueryChange, recent, onRecentToggle, chips, onRemoveChip, onClearAll, shown, total, moreColumns,
}: ArcFilterBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.search}>
        <TextInput className={styles.input} type="search" aria-label="Search ARCs" leadingVisual={SearchIcon}
          placeholder="Search ARCs by title, group, topic, person…" value={query}
          onChange={event => onQueryChange(event.target.value)} />
        <IconButton icon={HistoryIcon} size="small" variant="invisible" aria-label="Only recently changed ARCs"
          aria-pressed={recent} onClick={onRecentToggle} />
        {moreColumns}
      </div>
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
        <span role="status" className={styles.count}>Showing <strong>{shown}</strong> of {total} ARCs</span>
      </div>
    </div>
  )
}