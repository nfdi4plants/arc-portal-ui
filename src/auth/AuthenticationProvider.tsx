import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { getCurrentUser } from '../api/gitlab/index.ts'
import { availableDataHubs, defaultDataHub } from '../config/gitlab.ts'
import type { GitLabInstance } from '../types/gitlab.ts'
import { Failure } from '../types/result.ts'
import { AuthenticationContext, TOKEN_STORAGE_KEY, type AuthenticationState, type DataHubAuthentication } from './context.ts'

function readSavedTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY)
    if (!raw) return {}
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch {
      // Credentials saved before multiple-instance support belong to the official DataHub.
      return { [defaultDataHub.id]: raw }
    }
    if (!parsed || typeof parsed !== 'object') return {}
    const saved = parsed as Record<string, unknown>
    return Object.fromEntries(availableDataHubs
      .filter(dataHub => typeof saved[dataHub.id] === 'string' && saved[dataHub.id])
      .map(dataHub => [dataHub.id, saved[dataHub.id] as string]))
  } catch { return {} }
}

function saveTokens(tokens: Record<string, string>) {
  try {
    if (Object.keys(tokens).length) localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch { /* Login remains usable when storage is unavailable. */ }
}

export function AuthenticationProvider({ children }: { children: ReactNode }) {
  const [initialTokens] = useState(readSavedTokens)
  const savedTokens = useRef(initialTokens)
  const requests = useRef(new Map<string, AbortController>())
  const [accounts, setAccounts] = useState<Record<string, DataHubAuthentication>>(() => Object.fromEntries(
    availableDataHubs.map(dataHub => [dataHub.id, {
      session: null, hasSavedToken: !!initialTokens[dataHub.id], checking: !!initialTokens[dataHub.id], error: null,
    }]),
  ))

  const updateAccount = useCallback((dataHubId: string, update: Partial<DataHubAuthentication>) => {
    setAccounts(previous => ({ ...previous, [dataHubId]: { ...previous[dataHubId], ...update } }))
  }, [])

  const cancelLogin = useCallback((dataHubId: string) => {
    requests.current.get(dataHubId)?.abort()
    requests.current.delete(dataHubId)
    updateAccount(dataHubId, { checking: false })
  }, [updateAccount])

  const validateToken = useCallback(async (dataHub: GitLabInstance, rawToken: string): ReturnType<AuthenticationState['login']> => {
    const dataHubId = dataHub.id
    requests.current.get(dataHubId)?.abort()
    const token = rawToken.trim()
    const controller = new AbortController()
    requests.current.set(dataHubId, controller)
    const result = await getCurrentUser(dataHub.url, { token, signal: controller.signal })
    if (controller.signal.aborted || requests.current.get(dataHubId) !== controller) return Failure('Login canceled.')
    requests.current.delete(dataHubId)
    if (result.success === true) {
      savedTokens.current = { ...savedTokens.current, [dataHubId]: token }
      saveTokens(savedTokens.current)
      updateAccount(dataHubId, { session: { token, user: result.value }, hasSavedToken: true, checking: false, error: null })
    } else {
      updateAccount(dataHubId, { checking: false, error: result.error })
    }
    return result
  }, [updateAccount])

  const login = useCallback<AuthenticationState['login']>(async (dataHubId, token) => {
    const dataHub = availableDataHubs.find(dataHub => dataHub.id === dataHubId)
    if (!dataHub) return Failure('Unknown DataHub instance.')
    updateAccount(dataHubId, { checking: true, error: null })
    return validateToken(dataHub, token)
  }, [updateAccount, validateToken])

  useEffect(() => {
    for (const dataHub of availableDataHubs) {
      const token = initialTokens[dataHub.id]
      // oxlint-disable-next-line react/set-state-in-effect -- Saved credentials are validated asynchronously against GitLab.
      if (token) void validateToken(dataHub, token)
    }
    const controllers = requests.current
    return () => {
      for (const controller of controllers.values()) controller.abort()
      controllers.clear()
    }
  }, [initialTokens, validateToken])

  const logout = useCallback((dataHubId: string) => {
    cancelLogin(dataHubId)
    const remaining = { ...savedTokens.current }
    delete remaining[dataHubId]
    savedTokens.current = remaining
    saveTokens(remaining)
    updateAccount(dataHubId, { session: null, hasSavedToken: false, error: null })
  }, [cancelLogin, updateAccount])

  return <AuthenticationContext value={{
    accounts, login, retrySavedLogin: dataHubId => login(dataHubId, savedTokens.current[dataHubId] ?? ''), cancelLogin, logout,
  }}>{children}</AuthenticationContext>
}
