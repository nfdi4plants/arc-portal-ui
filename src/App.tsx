import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { useMemo, useRef, useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { listAllGroups, listAllProjects } from './api/gitlab/index.ts'
import { availableDataHubs } from './config/gitlab.ts'
import type { DataHubConnection } from './types/dashboard.ts'
import { Success } from './types/result.ts'
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
        fetchProjects: signal => listAllProjects(hub.url, { token, signal }),
        fetchGroups: signal => listAllGroups(hub.url, { allAvailable: true, token, signal }),
        // Contributor details arrive with the people features.
        fetchContributors: async () => Success([]),
        fetchLatestCommit: async () => Success(null),
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
      <DataHubDashboard connections={connections} signedIn={connections.some(c => c.includesPrivate)}
        onArcClick={(url, name) => setPageState({ type: "arc-dashboard", data: { url, name } })} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <AuthenticationProvider><Portal /></AuthenticationProvider>
  </BaseStyles></ThemeProvider>
}
