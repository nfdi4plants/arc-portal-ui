import { useRef, useState, type FormEvent, type RefObject } from 'react'
import { Banner, Button, Dialog, FormControl, Link, Spinner, Text, TextInput } from '@primer/react'
import { useAuthentication } from '../../auth/context.ts'
import { referenceGitLab } from '../../config/gitlab.ts'
import styles from './Authentication.module.css'

const tokenUrl = new URL(`${referenceGitLab.source}/-/user_settings/personal_access_tokens`)
tokenUrl.search = new URLSearchParams({
  name: 'arc-portal',
  description: 'ARC portal. Read your user profile and browse repositories and organisations you can access.',
  scopes: 'read_user,read_api',
}).toString()

export default function Authentication({ onClose, returnFocusRef }: {
  onClose: () => void
  returnFocusRef: RefObject<HTMLButtonElement | null>
}) {
  const [token, setToken] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { login, retrySavedLogin, checking, error, hasSavedToken, logout } = useAuthentication()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checking || !token.trim()) return
    const result = await login(token)
    if (result.success === true) onClose()
  }

  async function retry() {
    if (checking) return
    const result = await retrySavedLogin()
    if (result.success === true) onClose()
  }

  return <Dialog title="Login to GitLab" onClose={onClose} width="large" height="auto"
    initialFocusRef={inputRef} returnFocusRef={returnFocusRef}>
    <form onSubmit={submit} className={styles.form}>
      <Text as="p">Public ARCs are available without login. Sign in to browse repositories and organisations you can access.</Text>
      <FormControl disabled={checking}>
        <FormControl.Label>Personal access token</FormControl.Label>
        <TextInput ref={inputRef} type="password" name="token" autoComplete="off" block
          value={token} onChange={event => setToken(event.target.value)} />
        <FormControl.Caption>Login is remembered in this browser until you log out.</FormControl.Caption>
      </FormControl>
      <Link href={tokenUrl.href} target="_blank" rel="noopener noreferrer">Generate a GitLab Personal Access Token</Link>
      {error && <Banner variant="critical" role="alert">
        <Banner.Title as="h3">Unable to log in</Banner.Title>
        <Banner.Description>{error}</Banner.Description>
      </Banner>}
      {checking && <Text as="p" role="status"><Spinner size="small" /> Checking token…</Text>}
      {hasSavedToken && <div className={styles.savedActions}>
        <Button type="button" onClick={retry} disabled={checking}>Retry saved login</Button>
        <Button type="button" onClick={logout}>Forget saved login</Button>
      </div>}
      <div className={styles.actions}>
        <Button type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={checking || !token.trim()}>Login</Button>
      </div>
    </form>
  </Dialog>
}
