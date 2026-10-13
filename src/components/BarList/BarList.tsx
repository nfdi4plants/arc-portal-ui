import { SkeletonBox } from '@primer/react'
import styles from './BarList.module.css'

export interface BarItem {
  key: string
  label: string
  count: number | null
  loading?: boolean
  capped?: boolean
  title?: string
}

export interface BarListProps {
  title: string
  items: BarItem[]
  activeKey?: string
  onToggle?: (key: string) => void
  max?: number
}

export function BarList({ title, items, activeKey, onToggle, max = 6 }: BarListProps) {
  const shown = items.slice(0, max)
  const maxCount = Math.max(1, ...shown.map(item => item.count ?? 0))
  return (
    <section aria-label={title} className={styles.panel}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {shown.map(item => {
          const dimmed = activeKey !== undefined && item.key !== activeKey
          const name = item.title ?? item.label
          const countLabel = item.count === null ? (item.loading ? 'Loading count' : 'Count unavailable')
            : `${item.capped ? item.count.toLocaleString('en-US') + '+' : item.count} ARCs`
          const content = <>
            <span className={styles.label} title={item.title ?? item.label}>{item.label}</span>
            <span className={styles.track} aria-hidden="true">
              {item.loading ? <SkeletonBox height="8px" width="100%" />
                : <span className={`${styles.bar}${item.capped ? ` ${styles.capped}` : ''}`}
                  style={{ width: `${((item.count ?? 0) / maxCount) * 100}%` }} />}
            </span>
            <span className={styles.count}>{item.loading ? <SkeletonBox height="16px" width="100%" />
              : item.count === null ? '–' : item.capped ? `${item.count.toLocaleString('en-US')}+` : item.count}</span>
          </>
          return (
            <li key={item.key} className={dimmed ? styles.dimmed : undefined}>
              {onToggle
                ? <button type="button" className={styles.row} aria-pressed={item.key === activeKey}
                  aria-label={`${name}: ${countLabel}`} aria-busy={item.loading || undefined}
                  onClick={() => onToggle(item.key)}>{content}</button>
                : <div className={styles.row}>{content}</div>}
            </li>
          )
        })}
      </ul>
      {items.length > max && <p className={styles.more}>+ {items.length - max} more</p>}
      {items.some(item => item.capped) && <p className={styles.more}>Gradient bars show counts of 10,000 or more.</p>}
    </section>
  )
}
