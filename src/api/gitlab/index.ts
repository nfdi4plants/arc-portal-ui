export { GitLabApiError } from './client.ts'
export { listProjects, getProject, getTopStarredProjects, searchProjects } from './projects.ts'
export type {
  GitLabProject, GitLabRequestOptions, GitLabPage, ListProjectsOptions,
  TopStarredProjectsOptions, SearchProjectsOptions,
} from '../../types/gitlab.ts'
