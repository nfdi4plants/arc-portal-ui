import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { useState } from 'react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'
import { getGroupProjects, getTopStarredProjects, listAllGroups, searchProjects } from './api/gitlab/index.ts'
import { AuthenticationProvider } from './auth/AuthenticationProvider.tsx'
import { useAuthentication } from './auth/context.ts'
import { Navbar } from './components/Navbar/Navbar.tsx'
import ArcDashboard from './components/ArcDashboard/ArcDashboard.tsx'

const fetchPublicGroups = (source: string, signal: AbortSignal) => listAllGroups(source, { visibility: 'public', signal })
const fetchMembershipGroups = (source: string, signal: AbortSignal, token: string) => listAllGroups(source, { token, allAvailable: false, signal })

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
  const tokens = Object.fromEntries(Object.entries(accounts)
    .filter(([, account]) => account.session)
    .map(([id, account]) => [id, account.session!.token]))

  return <>
    <Navbar />
    {
      pageState.type === "arc-dashboard" ? (
        <ArcDashboard url={pageState.data.url} name={pageState.data.name} onBack={() => setPageState({ type: "datahub-dashboard" })} />
      ) :
      <DataHubDashboard 
        onArcClick={(url, name) => setPageState({ type: "arc-dashboard", data: { url, name } })}
        fetchTopStarred={getTopStarredProjects} fetchSearch={searchProjects} tokens={tokens}
        organisations={{ fetchPublicGroups, fetchMembershipGroups, fetchGroupProjects: getGroupProjects }} />
    }
  </>
}

export default function App() {
  return <ThemeProvider><BaseStyles>
    <AuthenticationProvider><Portal /></AuthenticationProvider>
  </BaseStyles></ThemeProvider>
}
