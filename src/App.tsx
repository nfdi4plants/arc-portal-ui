import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles, Spinner } from '@primer/react'
import { useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { DashboardConfigurationProvider } from './components/DataHubDashboard/DashboardConfigurationProvider.tsx'
import { AuthenticationProvider } from './auth/AuthenticationProvider.tsx'
import { useAuthentication } from './auth/context.ts'
import { Navbar } from './components/Navbar/Navbar.tsx'
import ArcDashboard from './components/ArcDashboard/ArcDashboard.tsx'
import { ScrollingDashboardContent } from './components/ArcDashboard/ScrollingDashboard/ScrollingDashboard.tsx'
import type { GitLabInstance } from './types/gitlab.ts'


type PageState =
  | {
    type: "datahub-dashboard";
  }
  | {
    type: "arc-dashboard";
    data: {
      url: string;
      name: string;
      projectId: number;
      dataHub: GitLabInstance;
    };
  };

function Portal() {
  const { accounts } = useAuthentication()
  const checking = Object.values(accounts).some(account => account.checking)
  const [authenticationReady, setAuthenticationReady] = useState(() => !checking)
  // Release the initial gate once; later login checks keep the dashboard mounted.
  if (!checking && !authenticationReady) setAuthenticationReady(true)
  const [pageState, setPageState] = useState<PageState>({ type: "datahub-dashboard" })
  const tokens = Object.fromEntries(Object.entries(accounts)
    .filter(([, account]) => account.session)
    .map(([id, account]) => [id, account.session!.token]))

  return <>
    <Navbar />
    {
      !authenticationReady ? (
        <main role="status" aria-label="Checking saved logins" aria-busy="true" style={{ padding: 32 }}>
          <Spinner size="small" /> Checking saved logins…
        </main>
      ) : pageState.type === "arc-dashboard" ? (
        <ArcDashboard name={pageState.data.name} url={pageState.data.url}
          content={ScrollingDashboardContent}
          fillHeight={false}
          source={pageState.data.dataHub.url} projectId={pageState.data.projectId} token={tokens[pageState.data.dataHub.id]}
          onBack={() => setPageState({ type: "datahub-dashboard" })} />
      ) :
      <DataHubDashboard
        onArcClick={(url, name, projectId, dataHub) => setPageState({ type: "arc-dashboard", data: { url, name, projectId, dataHub } })} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <DashboardConfigurationProvider><AuthenticationProvider><Portal /></AuthenticationProvider></DashboardConfigurationProvider>
  </BaseStyles></ThemeProvider>
}
