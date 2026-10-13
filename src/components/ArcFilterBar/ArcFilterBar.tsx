import type { ReactNode } from 'react'
import { SearchIcon, XIcon } from '@primer/octicons-react'
import { ActionList, ActionMenu, Button, IconButton, TextInput, Token } from '@primer/react'
import type { SearchScope } from '../../types/dashboard.ts'
import { SCOPES, type ChipKind } from './scopes.ts'
import styles from './ArcFilterBar.module.css'

export interface ArcFilterBarProps {
  query: string
  scope: SearchScope
  onQueryChange: (query: string) => void
  onScopeChange: (scope: SearchScope) => void
  chips: { kind: ChipKind; label: string }[]
  onRemoveChip: (kind: ChipKind) => void
  onClearAll: () => void
  shown: number
  total: number
  /** Slot for the "More columns" menu. */
  moreColumns?: ReactNode
}

export function ArcFilterBar({
  query, scope, onQueryChange, onScopeChange, chips, onRemoveChip, onClearAll, shown, total, moreColumns,
}: ArcFilterBarProps) {
  const scopeLabel = SCOPES.find(item => item.scope === scope)!.label
  return (
    <div className={styles.bar}>
      <div className={styles.search}>
        <TextInput className={styles.input} type="search" aria-label="Search ARCs" leadingVisual={SearchIcon}
          placeholder="Search ARCs by title, group, topic, person…" value={query}
          onChange={event => onQueryChange(event.target.value)} />
        <ActionMenu>
          <ActionMenu.Button>Search in: {scopeLabel}</ActionMenu.Button>
          <ActionMenu.Overlay>
            <ActionList selectionVariant="single">
              {SCOPES.map(item => (
                <ActionList.Item key={item.scope} selected={item.scope === scope} onSelect={() => onScopeChange(item.scope)}>
                  {item.label}
                </ActionList.Item>
              ))}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
        {moreColumns}
      </div>
      <div className={styles.filters}>
        <span className={styles.label}>Filters:</span>
        {chips.length === 0 && <span className={styles.hint}>No filters. Click a card, a bar, or search to narrow down.</span>}
        {chips.map(chip => (
          <span key={chip.kind} className={styles.chip}>
            {/* Primer's own remove button is always named "Remove token", so it is replaced by a named one. */}
            <Token text={chip.label} hideRemoveButton onRemove={() => onRemoveChip(chip.kind)} />
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
