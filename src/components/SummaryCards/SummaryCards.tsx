import type { ReactNode } from 'react'
import type { HeadlineNumbers } from '../DataHubDashboard/logic/summary.ts'
import type { AccessMode } from '../../types/dashboard.ts'
import styles from './SummaryCards.module.css'

export interface SummaryCardsProps {
  numbers: HeadlineNumbers
  /** Totals before filters; when given, count cards show "of {total}". */
  totals?: HeadlineNumbers
  signedIn: boolean
  accessMode: AccessMode
  /** The access filter currently applied, if any. */
  activeAccess?: 'public' | 'private'
  /** Called when one of the count cards is clicked; "all" clears the filters. */
  onSelect?: (kind: 'all' | 'public' | 'private') => void
}

interface CardProps {
  pressed?: boolean
  onClick?: () => void
  children: ReactNode
}

/** A card is a toggle button only when it has a click handler. */
function Card({ pressed, onClick, children }: CardProps) {
  return onClick
    ? <button type="button" className={`${styles.card} ${styles.button} ${pressed ? styles.active : ''}`}
      aria-pressed={pressed} onClick={onClick}>{children}</button>
    : <div className={styles.card}>{children}</div>
}

export function SummaryCards({ numbers, totals, signedIn, accessMode, activeAccess, onSelect }: SummaryCardsProps) {
  const privateHidden = !signedIn || accessMode === 'public'
  return (
    <section aria-label="Summary" className={styles.cards}>
      <Card pressed={activeAccess === undefined} onClick={onSelect && (() => onSelect('all'))}>
        <span className={styles.value}>{numbers.total}</span>
        <span className={styles.label}>ARCs</span>
        {totals && <span className={styles.caption}>of {totals.total}</span>}
      </Card>
      <Card pressed={activeAccess === 'public'} onClick={onSelect && (() => onSelect('public'))}>
        <span className={styles.value}><span className={`${styles.dot} ${styles.green}`} aria-hidden="true" />{numbers.public}</span>
        <span className={styles.label}>Shared publicly</span>
        {totals && <span className={styles.caption}>of {totals.public}</span>}
      </Card>
      <Card pressed={activeAccess === 'private'} onClick={onSelect && !privateHidden ? () => onSelect('private') : undefined}>
        <span className={styles.value}><span className={`${styles.dot} ${styles.amber}`} aria-hidden="true" />{privateHidden ? '–' : numbers.private}</span>
        <span className={styles.label}>Private</span>
        {privateHidden ? <span className={styles.caption}>log in to see</span>
          : totals && <span className={styles.caption}>of {totals.private}</span>}
      </Card>
      <div className={styles.card}>
        <span className={styles.value}>{numbers.hubs}</span>
        <span className={styles.label}>DataHUBs</span>
        <span className={styles.caption}>where these ARCs are stored</span>
      </div>
      <div className={styles.card}>
        <span className={styles.value}>{numbers.people ?? '—'}</span>
        <span className={styles.label}>People</span>
        <span className={styles.caption}>worked on these ARCs</span>
      </div>
      <div className={`${styles.card} ${styles.disabled}`} aria-disabled="true">
        <span className={styles.value}>Coming soon</span>
        <span className={styles.label}>Published</span>
        <span className={styles.caption}>Needs the ARChive connection</span>
      </div>
    </section>
  )
}
