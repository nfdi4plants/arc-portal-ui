import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import DataHubDashboard from './components/DataHubDashboard/DataHubDashboard.tsx'

export default function App() {
  return <ThemeProvider><BaseStyles><DataHubDashboard /></BaseStyles></ThemeProvider>
}
