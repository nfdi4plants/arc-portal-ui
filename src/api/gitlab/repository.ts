import type { GitLabCommit, GitLabContributor, GitLabRequestOptions } from '../../types/gitlab.ts'
import { Failure, Success, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'
import { requestPage, validIdentifier } from './page.ts'

function isContributor(data: unknown): data is GitLabContributor {
  return typeof data === 'object' && data !== null
    && 'name' in data && typeof data.name === 'string'
    && 'email' in data && typeof data.email === 'string'
    && 'commits' in data && typeof data.commits === 'number'
}

function isCommit(data: unknown): data is GitLabCommit {
  return typeof data === 'object' && data !== null
    && 'author_name' in data && typeof data.author_name === 'string'
    && 'committed_date' in data && typeof data.committed_date === 'string'
}

/** The first page of contributors (100) is enough for avatars and counts. */
export async function getContributors(source: string, projectId: number, options: GitLabRequestOptions = {}): Promise<Result<GitLabContributor[]>> {
  if (!validIdentifier(projectId)) return Failure('project id must be a positive integer.')
  const params = new URLSearchParams({ order_by: 'commits', sort: 'desc' })
  const result = await requestPage(source, `projects/${projectId}/repository/contributors`, params,
    { ...options, page: 1, perPage: 100 }, isContributor, 'contributor')
  return result.success === true ? Success(result.value.items) : Failure(result.error)
}

/** The newest commit, or `null` when the project has no commits or no repository. */
export async function getLatestCommit(source: string, projectId: number, options: GitLabRequestOptions = {}): Promise<Result<GitLabCommit | null>> {
  if (!validIdentifier(projectId)) return Failure('project id must be a positive integer.')
  const params = new URLSearchParams({ per_page: '1' })
  const result = await requestGitLab<unknown>(source, `projects/${projectId}/repository/commits`, params, options)
  if (result.success === false) {
    if (result.error.startsWith('GitLab request failed (404)')) return Success(null)
    return Failure(result.error)
  }
  const data = result.value.data
  if (!Array.isArray(data) || !data.every(isCommit)) return Failure('GitLab returned an invalid commit list.')
  return Success(data.length === 0 ? null : data[0])
}