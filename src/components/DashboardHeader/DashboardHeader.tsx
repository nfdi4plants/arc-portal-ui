import { Button, Heading, SegmentedControl, Text } from '@primer/react'
import type { AccessMode } from '../../types/dashboard.ts'
import { relativeTime } from '../DataHubDashboard/logic/time.ts'
import styles from './DashboardHeader.module.css'

export interface DashboardHeaderProps {
  hubCount: number
  /** DataHUBs that answered; fewer than `hubCount` means some failed. */
  okCount: number
  updatedAt: Date | null
  now: Date
  signedIn: boolean
  accessMode: AccessMode
  onAccessModeChange: (mode: AccessMode) => void
  onUpdate: () => void
  updating: boolean
}

const MODES: AccessMode[] = ['accessible', 'public']

export function DashboardHeader({
  hubCount, okCount, updatedAt, now, signedIn, accessMode, onAccessModeChange, onUpdate, updating,
}: DashboardHeaderProps) {
  const selected = signedIn ? accessMode : 'public'
  const hubs = okCount === hubCount ? `${hubCount} DataHUBs` : `${okCount} of ${hubCount} DataHUBs`
  return (
    <header className={styles.header}>
      <Heading as="h1" className={styles.title}>
        ARC Portal <Text className={styles.section}>/ Dashboard</Text>
      </Heading>
      <div className={styles.access}>
        <SegmentedControl aria-label="Which ARCs to show"
          onChange={index => { if (signedIn) onAccessModeChange(MODES[index]) }}>
          <SegmentedControl.Button selected={selected === 'accessible'} disabled={!signedIn}>ARCs I can access</SegmentedControl.Button>
          <SegmentedControl.Button selected={selected === 'public'} disabled={!signedIn}>Only public ARCs</SegmentedControl.Button>
        </SegmentedControl>
        {!signedIn && <Text className={styles.hint}>Log in to see private ARCs</Text>}
      </div>
      <div className={styles.status}>
        {updatedAt && <Text className={styles.updated}>Updated {relativeTime(updatedAt.toISOString(), now)} from {hubs}</Text>}
        <Button size="small" onClick={onUpdate} disabled={updating}>Update</Button>
      </div>
    </header>
  )
}
