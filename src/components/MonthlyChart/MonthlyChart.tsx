import styles from './MonthlyChart.module.css'

export interface MonthlyChartProps {
  months: { month: string; count: number }[]
}

const WIDTH = 360
const HEIGHT = 130
const TOP = 16
const BASE = 112
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })

export function MonthlyChart({ months }: MonthlyChartProps) {
  const sum = months.reduce((total, month) => total + month.count, 0)
  const max = Math.max(1, ...months.map(month => month.count))
  const slot = WIDTH / Math.max(1, months.length)
  const barWidth = slot * 0.6
  return (
    <section aria-label="New ARCs per month" className={styles.panel}>
      <h2 className={styles.title}>New ARCs per month</h2>
      <svg role="img" aria-label={`New ARCs per month: ${sum} in the last 12 months`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className={styles.svg}>
        {months.map(({ month, count }, index) => {
          const date = new Date(`${month}-01T00:00:00Z`)
          const height = (count / max) * (BASE - TOP - 12)
          const x = index * slot + (slot - barWidth) / 2
          return (
            <g key={month}>
              <title>{`${monthLabel.format(date)}: ${count}`}</title>
              <rect x={x} y={BASE - height} width={barWidth} height={height} rx={2}
                fill="var(--bgColor-accent-emphasis)" />
              <text x={x + barWidth / 2} y={BASE - height - 4} textAnchor="middle" className={styles.count}>{count}</text>
              <text x={x + barWidth / 2} y={BASE + 14} textAnchor="middle" className={styles.month}>{monthLabel.format(date)}</text>
            </g>
          )
        })}
        <line x1={0} x2={WIDTH} y1={BASE} y2={BASE} stroke="var(--borderColor-default)" />
      </svg>
      <p className={styles.caption}>{sum} new in the last 12 months</p>
    </section>
  )
}
