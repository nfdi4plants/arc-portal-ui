import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { getContributors, getLatestCommit, listAllGroups, listAllProjects, listMemberProjectIds } from './api/gitlab/index.ts'
import { AuthenticationProvider } from './auth/AuthenticationProvider.tsx'
import { useAuthentication } from './auth/context.ts'
import { Navbar } from './components/Navbar/Navbar.tsx'
import ArcDashboard from './components/ArcDashboard/ArcDashboard.tsx'
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
  const [pageState, setPageState] = useState<PageState>({ type: "datahub-dashboard" })
  const tokens = Object.fromEntries(Object.entries(accounts)
    .filter(([, account]) => account.session)
    .map(([id, account]) => [id, account.session!.token]))

  return <>
    <Navbar />
    {
      pageState.type === "arc-dashboard" ? (
        <ArcDashboard name={pageState.data.name} url={pageState.data.url}
          source={pageState.data.dataHub.url} projectId={pageState.data.projectId} token={tokens[pageState.data.dataHub.id]}
          onBack={() => setPageState({ type: "datahub-dashboard" })} />
      ) :
      <DataHubDashboard
        onArcClick={(url, name, projectId, dataHub) => setPageState({ type: "arc-dashboard", data: { url, name, projectId, dataHub } })}
        fetchProjects={listAllProjects} fetchGroups={listAllGroups} fetchMemberProjectIds={listMemberProjectIds}
        fetchContributors={getContributors} fetchLatestCommit={getLatestCommit} tokens={tokens} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <AuthenticationProvider><Portal /></AuthenticationProvider>
  </BaseStyles></ThemeProvider>
}
