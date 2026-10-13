import { useState } from 'react'
import { UnderlinePanels } from '@primer/react/experimental'
import type { CountItem } from '../../types/dashboard.ts'
import { BarList } from '../BarList/BarList.tsx'
import styles from './WorkingGroupChart.module.css'

export interface WorkingGroupChartProps {
  myItems: CountItem[]
  publicItems: CountItem[]
  loggedIn: boolean
  /** DataHUB names whose membership list could not be loaded. */
  membershipErrors: string[]
  activeKey?: string
  onToggle: (key: string) => void
}

export function WorkingGroupChart({ myItems, publicItems, loggedIn, membershipErrors, activeKey, onToggle }: WorkingGroupChartProps) {
  // The tab follows login and logout; in between it is the visitor's choice.
  const [tab, setTab] = useState(loggedIn ? 'my' : 'public')
  const [lastLoggedIn, setLastLoggedIn] = useState(loggedIn)
  if (loggedIn !== lastLoggedIn) {
    setLastLoggedIn(loggedIn)
    setTab(loggedIn ? 'my' : 'public')
  }
  return (
    <section aria-label="ARCs per working group" className={styles.panel}>
      <h2 className={styles.title}>ARCs per working group</h2>
      <UnderlinePanels aria-label="Working groups" value={tab} onChange={({ value }) => setTab(value)}>
        <UnderlinePanels.Tab value="my">My ARCs</UnderlinePanels.Tab>
        <UnderlinePanels.Tab value="public">Public ARCs</UnderlinePanels.Tab>
        <UnderlinePanels.Panel value="my" className={styles.tabPanel}>
          {loggedIn
            ? <>
              <BarList title="My working groups" items={myItems} activeKey={activeKey} onToggle={onToggle} />
              {membershipErrors.length > 0 &&
                <p className={styles.error}>Could not load your memberships for {membershipErrors.join(', ')}.</p>}
            </>
            : <p className={styles.error}>Log in to see your ARCs.</p>}
        </UnderlinePanels.Panel>
        <UnderlinePanels.Panel value="public" className={styles.tabPanel}>
          <BarList title="Public working groups" items={publicItems} activeKey={activeKey} onToggle={onToggle} />
        </UnderlinePanels.Panel>
      </UnderlinePanels>
    </section>
  )
}