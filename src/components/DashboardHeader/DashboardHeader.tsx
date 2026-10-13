import { Button, Heading, Text } from '@primer/react'
import { SyncIcon } from '@primer/octicons-react'
import { relativeTime } from '../../util/time.ts'
import styles from './DashboardHeader.module.css'

export interface DashboardHeaderProps {
  hubCount: number
  /** DataHUBs that answered; fewer than `hubCount` means some failed. */
  okCount: number
  updatedAt: Date | null
  now: Date
  onUpdate: () => void
  updating: boolean
}

export function DashboardHeader({ hubCount, okCount, updatedAt, now, onUpdate, updating }: DashboardHeaderProps) {
  const hubs = okCount === hubCount ? `${hubCount} DataHUBs` : `${okCount} of ${hubCount} DataHUBs`
  return (
    <header className={styles.header}>
      <Heading as="h1" className={styles.title}>
        Dashboard
      </Heading>
      <div className={styles.status}>
        {updatedAt && <Text className={styles.updated}>Updated {relativeTime(updatedAt.toISOString(), now)} from {hubs}</Text>}
        <Button size="small" variant="primary" leadingVisual={SyncIcon} onClick={onUpdate} disabled={updating}>Update</Button>
      </div>
    </header>
  )
}