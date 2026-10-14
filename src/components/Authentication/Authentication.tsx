import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Banner, Button, Dialog, FormControl, Link, Spinner, Text, TextInput } from '@primer/react'
import { useAuthentication } from '../../auth/context.ts'
import { availableDataHubs } from '../../config/gitlab.ts'
import type { GitLabInstance } from '../../types/gitlab.ts'
import { DataHubSelect } from '../DataHubSelect/DataHubSelect.tsx'
import styles from './Authentication.module.css'

export default function Authentication({ current, setCurrent, onClose, returnFocusRef }: {
  current: GitLabInstance
  setCurrent: (dataHub: GitLabInstance) => void
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}) {
  const [token, setToken] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { accounts, login, retrySavedLogin, cancelLogin, logout } = useAuthentication()
  const { session, checking, error, hasSavedToken } = accounts[current.id]
  const tokenUrl = new URL(`${current.url.replace(/\/+$/, '')}/-/user_settings/personal_access_tokens`)
  tokenUrl.search = new URLSearchParams({
    name: 'arc-portal',
    description: 'ARC portal. Browse repositories and organisations you can access, and star or unstar repositories.',
    scopes: 'api',
  }).toString()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checking || !token.trim()) return
    const result = await login(current.id, token)
    if (result.success === true) onClose()
  }

  async function retry() {
    if (checking) return
    const result = await retrySavedLogin(current.id)
    if (result.success === true) onClose()
  }

  return <Dialog title="Login to GitLab" onClose={onClose} width="large" height="auto"
    initialFocusRef={inputRef} returnFocusRef={returnFocusRef}>
    <form onSubmit={submit} className={styles.form}>
      <Text as="p">Public ARCs are available without login. Sign in to browse repositories and organisations you can access, and star repositories.</Text>
      <DataHubSelect availableDataHubs={availableDataHubs} current={current} setCurrent={dataHub => {
        cancelLogin(current.id)
        setToken('')
        setCurrent(dataHub)
      }} />
      {session && <Text as="p">Signed in as {session.user.name} (@{session.user.username}) on {current.name}.</Text>}
      <FormControl disabled={checking}>
        <FormControl.Label>Personal access token</FormControl.Label>
        <TextInput ref={inputRef} type="password" name="token" autoComplete="off" block
          value={token} onChange={event => setToken(event.target.value)} />
        <FormControl.Caption>Login is remembered for this instance in this browser until you log out.</FormControl.Caption>
      </FormControl>
      <Link href={tokenUrl.href} target="_blank" rel="noopener noreferrer">Generate a GitLab Personal Access Token</Link>
      <Text as="p">Use the <code>api</code> scope to star and unstar repositories. Tokens with <code>read_api</code> can still browse repositories.</Text>
      {error && <Banner variant="critical" role="alert">
        <Banner.Title as="h3">Unable to log in</Banner.Title>
        <Banner.Description>{error}</Banner.Description>
      </Banner>}
      {checking && <Text as="p" role="status"><Spinner size="small" /> Checking token…</Text>}
      {hasSavedToken && <div className={styles.savedActions}>
        <Button type="button" onClick={retry} disabled={checking}>Retry saved login</Button>
        <Button type="button" onClick={() => logout(current.id)}>Forget saved login</Button>
      </div>}
      <div className={styles.actions}>
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={checking || !token.trim()}>Login</Button>
      </div>
    </form>
  </Dialog>
}
