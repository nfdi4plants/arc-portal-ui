import { createContext, useContext } from 'react'
import type { GitLabUser } from '../types/gitlab.ts'
import type { Result } from '../types/result.ts'

export const TOKEN_STORAGE_KEY = 'arc-portal-gitlab-token'

export interface DataHubAuthentication {
  session: { token: string; user: GitLabUser } | null
  hasSavedToken: boolean
  checking: boolean
  error: string | null
}

export interface AuthenticationState {
  accounts: Record<string, DataHubAuthentication>
  login: (dataHubId: string, token: string) => Promise<Result<GitLabUser>>
  retrySavedLogin: (dataHubId: string) => Promise<Result<GitLabUser>>
  cancelLogin: (dataHubId: string) => void
  logout: (dataHubId: string) => void
}

export const AuthenticationContext = createContext<AuthenticationState | null>(null)

export function useAuthentication() {
  const context = useContext(AuthenticationContext)
  if (!context) throw new Error('AuthenticationProvider is required.')
  return context
}
