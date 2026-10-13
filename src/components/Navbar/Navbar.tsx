import { useRef, useState } from 'react'
import { Button, Link, Text } from '@primer/react'
import { useAuthentication } from '../../auth/context.ts'
import Authentication from '../Authentication/Authentication.tsx'
import styles from './Navbar.module.css'

export function Navbar() {
  const { session, checking, cancelLogin, logout } = useAuthentication()
  const [open, setOpen] = useState(false)
  const loginButton = useRef<HTMLButtonElement>(null)

  function close() {
    cancelLogin()
    setOpen(false)
  }

  return <>
    <nav className={styles.navbar} aria-label="Main navigation">
      <div className={styles.content}>
        <Link href="#" className={styles.brand}>DataPLANT · ARC portal</Link>
        <div className={styles.account}>
          {session ? <>
            <div className={styles.identity}>
              <Text weight="semibold">{session.user.name}</Text>
              <Text size="small" className={styles.username}>@{session.user.username}</Text>
            </div>
            <Button onClick={logout}>Logout</Button>
          </> : <>
            {checking && <Text size="small" role="status">Checking login…</Text>}
            <Button ref={loginButton} onClick={() => setOpen(true)}>Login</Button>
          </>}
        </div>
      </div>
    </nav>
    {open && <Authentication onClose={close} returnFocusRef={loginButton} />}
  </>
}
