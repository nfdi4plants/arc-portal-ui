import { DatabaseIcon, FileBadgeIcon, GlobeIcon, LockIcon, PersonIcon, ServerIcon } from '@primer/octicons-react'
import type { Access, HeadlineNumbers } from '../../types/dashboard.ts'
import styles from './StatsSidebar.module.css'

export interface StatsSidebarProps {
  numbers: HeadlineNumbers
  /** Shown as "of {total}" when filters are active. */
  totals?: HeadlineNumbers
  filtersActive: boolean
  activeAccess?: Access
  onSelect: (kind: 'all' | Access) => void
  privateState: 'hidden' | 'partial' | 'all'
  privateNote?: string
}

function numberValue(value: number | null) {
  return value === null ? '–' : String(value)
}

function countCard(id: string, label: string, count: number, total: number | undefined, pressed: boolean, icon: typeof DatabaseIcon, onClick: () => void) {
  const Icon = icon
  return (
    <button type="button" className={styles.stat} aria-pressed={pressed} aria-labelledby={`${id}-label`}
      aria-describedby={`${id}-desc`} onClick={onClick}>
      <span className={styles.icon}><Icon size={16} /></span>
      <span className={styles.value}>{count}</span>
      <span id={`${id}-label`} className={styles.label}>{label}</span>
      <span id={`${id}-desc`} className={styles.describedBy}>{count} of {total ?? count}</span>
    </button>
  )
}

export function StatsSidebar({ numbers, totals, filtersActive, activeAccess, onSelect, privateState, privateNote }: StatsSidebarProps) {
  return (
    <aside aria-label="Summary" className={styles.sidebar}>
      {countCard('accessible', 'ARCs accessible', numbers.total, totals?.total, !filtersActive,
        DatabaseIcon, () => onSelect('all'))}
      {countCard('public', 'shared publicly', numbers.public, totals?.total, activeAccess === 'public',
        GlobeIcon, () => onSelect('public'))}
      {privateState === 'hidden'
        ? <div className={styles.stat} role="group" aria-labelledby="private-label">
          <span className={styles.icon}><LockIcon size={16} /></span>
          <span className={styles.value}>–</span>
          <span id="private-label" className={styles.label}>private</span>
          <span className={styles.caption}>log in to see</span>
        </div>
        : countCard('private', 'private', numbers.private, totals?.total, activeAccess === 'private',
          LockIcon, () => onSelect('private'))}
      <div className={styles.stat} role="group" aria-labelledby="hubs-label">
        <span className={styles.icon}><ServerIcon size={16} /></span>
        <span className={styles.value}>{numbers.hubs}</span>
        <span id="hubs-label" className={styles.label}>DataHUBs</span>
      </div>
      <div className={styles.stat} role="group" aria-labelledby="people-label">
        <span className={styles.icon}><PersonIcon size={16} /></span>
        <span className={styles.value}>{numberValue(numbers.people)}</span>
        <span id="people-label" className={styles.label}>people</span>
      </div>
      <div className={`${styles.stat} ${styles.disabled}`} role="group" aria-labelledby="doi-label" aria-disabled="true">
        <span className={styles.icon}><FileBadgeIcon size={16} /></span>
        <span className={styles.value}>Coming soon</span>
        <span id="doi-label" className={styles.label}>with DOI</span>
        <span className={styles.caption}>Needs the ARChive connection</span>
      </div>
      {privateState === 'partial' && privateNote && <p className={styles.privateNote}>{privateNote}</p>}
    </aside>
  )
}