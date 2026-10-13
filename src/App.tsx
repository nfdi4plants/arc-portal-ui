import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { useMemo, useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { listAllGroups, listAllProjects } from './api/gitlab/index.ts'
import { dataHubs, isReferenceHub, referenceGitLab } from './config/gitlab.ts'
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
  const { session } = useAuthentication()
  const [pageState, setPageState] = useState<PageState>({ type: "datahub-dashboard" })
  const token = session?.token
  // A new array identity (login/logout) makes the dashboard abort and reload every DataHUB.
  const connections = useMemo<DataHubConnection[]>(() => dataHubs.map(hub => {
    // Only the reference DataHUB shares the portal login.
    const hubToken = isReferenceHub(hub) ? token : undefined
    return {
      hub,
      includesPrivate: !!hubToken,
      fetchProjects: signal => listAllProjects(hub.source, { token: hubToken, signal }),
      fetchGroups: signal => listAllGroups(hub.source, { allAvailable: true, token: hubToken, signal }),
      // Contributor details arrive with the people features.
      fetchContributors: async () => Success([]),
      fetchLatestCommit: async () => Success(null),
    }
  }), [token])

  return <>
    <Navbar />
    {
      pageState.type === "arc-dashboard" ? (
        <ArcDashboard url={pageState.data.url} name={pageState.data.name} onBack={() => setPageState({ type: "datahub-dashboard" })} />
      ) :
      <DataHubDashboard connections={connections} signedIn={!!session}
        onArcClick={(url, name) => setPageState({ type: "arc-dashboard", data: { url, name } })} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <AuthenticationProvider source={referenceGitLab.source}><Portal /></AuthenticationProvider>
  </BaseStyles></ThemeProvider>
}
