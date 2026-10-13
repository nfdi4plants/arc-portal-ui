import type { GitLabRequestOptions, GitLabUser } from '../../types/gitlab.ts'
import { Failure, map, type Result } from '../../types/result.ts'
import { requestGitLab } from './client.ts'

export async function getCurrentUser(source: string, options: GitLabRequestOptions = {}): Promise<Result<GitLabUser>> {
  if (!options.token?.trim()) return Failure('Enter a GitLab personal access token.')
  const response = await requestGitLab<GitLabUser>(source, 'user', new URLSearchParams(), options)
  if (response.success === false) return Failure(response.error)
  const user = response.value.data
  if (!user || typeof user.id !== 'number' || typeof user.name !== 'string' || typeof user.username !== 'string') {
    return Failure('GitLab returned an invalid user.')
  }
  return map(response, value => value.data)
}
