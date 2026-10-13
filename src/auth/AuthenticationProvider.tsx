import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { getCurrentUser } from '../api/gitlab/index.ts'
import { Failure } from '../types/result.ts'
import { AuthenticationContext, TOKEN_STORAGE_KEY, type AuthenticationState } from './context.ts'

function readSavedToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY) ?? '' } catch { return '' }
}

export function AuthenticationProvider({ source, children }: { source: string; children: ReactNode }) {
  const [session, setSession] = useState<AuthenticationState['session']>(null)
  const [savedToken, setSavedToken] = useState(readSavedToken)
  const initialToken = useRef(savedToken)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)

  const cancelLogin = useCallback(() => {
    request.current?.abort()
    request.current = null
    setChecking(false)
  }, [])

  const login = useCallback<AuthenticationState['login']>(async rawToken => {
    request.current?.abort()
    const token = rawToken.trim()
    const controller = new AbortController()
    request.current = controller
    setChecking(true)
    setError(null)
    const result = await getCurrentUser(source, { token, signal: controller.signal })
    if (controller.signal.aborted || request.current !== controller) return Failure('Login canceled.')
    request.current = null
    setChecking(false)
    if (result.success === true) {
      setSession({ token, user: result.value })
      setSavedToken(token)
      try { localStorage.setItem(TOKEN_STORAGE_KEY, token) } catch { /* Login remains usable when storage is unavailable. */ }
    } else {
      setError(result.error)
    }
    return result
  }, [source])

  useEffect(() => {
    if (initialToken.current) void login(initialToken.current)
    return cancelLogin
  }, [login, cancelLogin])

  const logout = useCallback(() => {
    cancelLogin()
    setSession(null)
    setSavedToken('')
    setError(null)
    try { localStorage.removeItem(TOKEN_STORAGE_KEY) } catch { /* Storage may be disabled in this browser. */ }
  }, [cancelLogin])

  return <AuthenticationContext value={{
    session, hasSavedToken: !!savedToken, checking, error, login,
    retrySavedLogin: () => login(savedToken), cancelLogin, logout,
  }}>{children}</AuthenticationContext>
}
