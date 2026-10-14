import { useState, type ReactNode } from 'react'
import { DashboardConfigurationContext, defaultDashboardConfiguration, type DashboardConfiguration } from './configuration.ts'

export function DashboardConfigurationProvider({ configuration = defaultDashboardConfiguration, children }: {
  configuration?: DashboardConfiguration
  children: ReactNode
}) {
  // Capture once: replacing configuration requires mounting a new provider.
  const [value] = useState(() => configuration)
  return <DashboardConfigurationContext value={value}>{children}</DashboardConfigurationContext>
}
