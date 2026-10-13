import { useRef, useState } from 'react'
import { AnchoredOverlay, Avatar, Button, Link, Text } from '@primer/react'
import { useAuthentication } from '../../auth/context.ts'
import { availableDataHubs, defaultDataHub } from '../../config/gitlab.ts'
import type { GitLabInstance, GitLabUser } from '../../types/gitlab.ts'
import fallbackAvatar from '../../assets/avatar.svg'
import Authentication from '../Authentication/Authentication.tsx'
import styles from './Navbar.module.css'

function AccountAvatar({ user, size }: { user: GitLabUser; size: number }) {
  return <Avatar src={user.avatar_url || fallbackAvatar} alt="" size={size} onError={event => {
    if (event.currentTarget.getAttribute('src') !== fallbackAvatar) event.currentTarget.src = fallbackAvatar
  }} />
}

export function Navbar() {
  const { accounts, cancelLogin, logout } = useAuthentication()
  const [currentDataHub, setCurrentDataHub] = useState<GitLabInstance>(defaultDataHub)
  const { session, checking } = accounts[currentDataHub.id]
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const loginButton = useRef<HTMLButtonElement>(null)
  const otherActiveDataHubs = availableDataHubs.filter(dataHub => dataHub.id !== currentDataHub.id && accounts[dataHub.id].session)

  function close() {
    cancelLogin(currentDataHub.id)
    setOpen(false)
  }

  return <>
    <nav className={styles.navbar} aria-label="Main navigation">
      <div className={styles.content}>
        <Link href="#" className={styles.brand}>DataPLANT · ARC portal</Link>
        <div className={styles.account}>
          {session ? <AnchoredOverlay open={accountOpen} onOpen={() => setAccountOpen(true)} onClose={() => setAccountOpen(false)}
            anchorRef={loginButton} align="end" width="medium" preventOverflow={false} className={styles.overlay}
            overlayProps={{ role: 'dialog', 'aria-label': 'Signed-in accounts' }}
            renderAnchor={props => <Button {...props} ref={loginButton} variant="invisible" aria-label="Account menu" aria-haspopup="dialog" className={styles.avatarButton}>
              <AccountAvatar user={session.user} size={32} />
            </Button>}>
            <div className={styles.profile}>
              <AccountAvatar user={session.user} size={48} />
              <div className={styles.identity}>
                <Text weight="semibold">{session.user.name}</Text>
                <Text size="small" className={styles.username}>@{session.user.username}</Text>
                <Link href={currentDataHub.url} className={styles.source}>{currentDataHub.name}</Link>
              </div>
            </div>
            {otherActiveDataHubs.length > 0 && <div className={styles.otherAccounts}>
              <Text as="p" size="small" weight="semibold" className={styles.accountsLabel}>Other active logins</Text>
              {otherActiveDataHubs.map(dataHub => <Button key={dataHub.id} block onClick={() => {
                setCurrentDataHub(dataHub)
                setAccountOpen(false)
              }}>{dataHub.name}</Button>)}
            </div>}
            <div className={styles.actions}>
              <Button block onClick={() => {
                setAccountOpen(false)
                setOpen(true)
              }}>Manage logins</Button>
              <Button block onClick={() => {
                setAccountOpen(false)
                logout(currentDataHub.id)
              }}>Logout</Button>
            </div>
          </AnchoredOverlay> : <>
            {checking && <Text size="small" role="status">Checking login…</Text>}
            <Button ref={loginButton} onClick={() => setOpen(true)}>Login</Button>
          </>}
        </div>
      </div>
    </nav>
    {open && <Authentication current={currentDataHub} setCurrent={setCurrentDataHub} onClose={close} returnFocusRef={loginButton} />}
  </>
}
