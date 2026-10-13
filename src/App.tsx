import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { useMemo, useRef, useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { AUTH_FAILED_MESSAGE } from './api/gitlab/client.ts'
import { getContributors, getLatestCommit, listAllGroups, listAllProjects, listMemberProjectIds } from './api/gitlab/index.ts'
import { availableDataHubs } from './config/gitlab.ts'
import type { DataHubConnection } from './types/dashboard.ts'
import { Failure, Success, type Result } from './types/result.ts'
import { AuthenticationProvider } from './auth/AuthenticationProvider.tsx'
import { useAuthentication } from './auth/context.ts'
import { Navbar } from './components/Navbar/Navbar.tsx'
import ArcDashboard from './components/ArcDashboard/ArcDashboard.tsx'


type PageState =
  | {
    type: "datahub-dashboard";
  }
  | {
    type: "arc-dashboard";
    data: {
      url: string;
      name: string;
    };
  };

/** A stale saved token falls back to the anonymous call once and reports the rejection. */
async function withAnonymousFallback<T>(token: string | undefined, call: (token?: string) => Promise<Result<T>>) {
  const result = await call(token)
  if (token && result.success === false && result.error === AUTH_FAILED_MESSAGE) return { result: await call(), rejected: true }
  return { result, rejected: false }
}

function Portal() {
  const { accounts } = useAuthentication()
  const [pageState, setPageState] = useState<PageState>({ type: "datahub-dashboard" })
  const tokenSignature = JSON.stringify(availableDataHubs.map(hub => accounts[hub.id]?.session?.token ?? null))
  // A DataHUB's connection object is reused while its token is unchanged, so
  // login changes on one DataHUB reload only that DataHUB (research R4).
  const connectionsCache = useRef(new Map<string, { token?: string; connection: DataHubConnection }>())
  // Rebuilt only when a token changes; `accounts` also changes on `checking`/`error` updates.
  const connections = useMemo<DataHubConnection[]>(() => {
    const tokens: (string | null)[] = JSON.parse(tokenSignature)
    /* oxlint-disable react/refs */
    const cache = connectionsCache.current
    return availableDataHubs.map((hub, index) => {
      const token = tokens[index] ?? undefined
      const cached = cache.get(hub.id)
      if (cached && cached.token === token) return cached.connection
      const connection: DataHubConnection = {
        hub,
        includesPrivate: !!token,
        fetchProjects: async signal => {
          const { result, rejected } = await withAnonymousFallback(token, current => listAllProjects(hub.url, { token: current, signal }))
          return result.success === true ? Success({ projects: result.value, tokenRejected: rejected }) : Failure(result.error)
        },
        fetchGroups: async signal => (await withAnonymousFallback(token, current => listAllGroups(hub.url, { allAvailable: true, token: current, signal }))).result,
        fetchMemberProjectIds: signal => token ? listMemberProjectIds(hub.url, { token, signal }) : Promise.resolve(Success([])),
        fetchContributors: (projectId, signal) => getContributors(hub.url, projectId, { token, signal }),
        fetchLatestCommit: (projectId, signal) => getLatestCommit(hub.url, projectId, { token, signal }),
      }
      cache.set(hub.id, { token, connection })
      return connection
    })
    /* oxlint-enable react/refs */
  }, [tokenSignature])

  return <>
    <Navbar />
    {
      pageState.type === "arc-dashboard" ? (
        <ArcDashboard url={pageState.data.url} name={pageState.data.name} onBack={() => setPageState({ type: "datahub-dashboard" })} />
      ) :
      <DataHubDashboard connections={connections}
        onArcClick={(url, name) => setPageState({ type: "arc-dashboard", data: { url, name } })} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <AuthenticationProvider><Portal /></AuthenticationProvider>
  </BaseStyles></ThemeProvider>
}
