import styles from './BarList.module.css'

export interface BarItem {
  key: string
  label: string
  count: number
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
  const maxCount = Math.max(1, ...shown.map(item => item.count))
  return (
    <section aria-label={title} className={styles.panel}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {shown.map(item => {
          const dimmed = activeKey !== undefined && item.key !== activeKey
          const name = item.title ?? item.label
          const content = <>
            <span className={styles.label} title={item.title ?? item.label}>{item.label}</span>
            <span className={styles.track} aria-hidden="true">
              <span className={styles.bar} style={{ width: `${(item.count / maxCount) * 100}%` }} />
            </span>
            <span className={styles.count}>{item.count}</span>
          </>
          return (
            <li key={item.key} className={dimmed ? styles.dimmed : undefined}>
              {onToggle
                ? <button type="button" className={styles.row} aria-pressed={item.key === activeKey}
                  aria-label={`${name}: ${item.count} ARCs`} onClick={() => onToggle(item.key)}>{content}</button>
                : <div className={styles.row}>{content}</div>}
            </li>
          )
        })}
      </ul>
      {items.length > max && <p className={styles.more}>+ {items.length - max} more</p>}
    </section>
  )
}
