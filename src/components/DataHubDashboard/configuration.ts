import { createContext, useContext } from 'react'
import { getGroupProjectCount, getGroupProjects, getProjectCount, listAllGroups, listProjects } from '../../api/gitlab/index.ts'
import { availableDataHubs } from '../../config/gitlab.ts'
import type { GitLabGroup, GitLabInstance } from '../../types/gitlab.ts'

/** Build configuration only. Sessions and fetched data belong to runtime hooks. */
export interface DashboardConfiguration {
  readonly dataHubs: readonly GitLabInstance[]
  readonly fetchProjectCount: typeof getProjectCount
  readonly fetchGroups: typeof listAllGroups
  readonly fetchGroupProjectCount: typeof getGroupProjectCount
  readonly fetchProjects: typeof listProjects
  readonly fetchGroupProjects: typeof getGroupProjects
}

export const defaultDashboardConfiguration: DashboardConfiguration = {
  dataHubs: availableDataHubs,
  fetchProjectCount: getProjectCount,
  fetchGroups: listAllGroups,
  fetchGroupProjectCount: getGroupProjectCount,
  fetchProjects: listProjects,
  fetchGroupProjects: getGroupProjects,
}

export interface DashboardGroup {
  key: string
  hub: GitLabInstance
  group: GitLabGroup
}

export const DashboardConfigurationContext = createContext<DashboardConfiguration | null>(null)

export function useDashboardConfiguration() {
  const context = useContext(DashboardConfigurationContext)
  if (!context) throw new Error('DashboardConfigurationProvider is required.')
  return context
}
