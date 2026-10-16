import type { GitLabPage, GitLabRequestOptions, GitLabVisibility } from '../../types/gitlab'
import { Failure, Success, type Result } from '../../types/result'
import { requestPage, validIdentifier } from './page'
import { getProject } from './projects'

export interface DataHubRepository {
  source: string
  projectPath: string
}

export interface ArcRepositoryVersion {
  tag: string
  name: string
  kind: 'release' | 'tag'
  description?: string
  date?: string
  commit?: string
  archiveSizeBytes?: number
  url: string
}

export interface ArcRepositoryOverview {
  versions: ArcRepositoryVersion[]
  latestReleaseArchiveSizeBytes?: number
  visibility?: GitLabVisibility
  owner?: { name: string; url?: string }
}

interface RepositoryTag {
  name: string
  message?: string | null
  created_at?: string | null
  commit: { id: string; committed_date?: string }
}

interface RepositoryRelease {
  tag_name: string
  name: string
  description?: string | null
  released_at?: string
  commit?: { id: string }
}

function isTag(value: unknown): value is RepositoryTag {
  return typeof value === 'object' && value !== null
    && 'name' in value && typeof value.name === 'string'
    && 'commit' in value && typeof value.commit === 'object' && value.commit !== null
    && 'id' in value.commit && typeof value.commit.id === 'string'
}

function isRelease(value: unknown): value is RepositoryRelease {
  return typeof value === 'object' && value !== null
    && 'tag_name' in value && typeof value.tag_name === 'string'
    && 'name' in value && typeof value.name === 'string'
}

export function dataHubRepositoryUrl({ source, projectPath }: DataHubRepository): string {
  return `${source.replace(/\/+$/, '')}/${projectPath.split('/').map(encodeURIComponent).join('/')}`
}

async function allPages<T>(
  source: string,
  resource: string,
  params: URLSearchParams,
  options: GitLabRequestOptions,
  isItem: (item: unknown) => item is T,
  label: string,
): Promise<Result<T[]>> {
  const items: T[] = []
  let page: number | null = 1
  while (page !== null) {
    const result: Result<GitLabPage<T>> = await requestPage(source, resource, params, { ...options, page, perPage: 100 }, isItem, label)
    if (result.success === false) return Failure(result.error)
    items.push(...result.value.items)
    page = result.value.nextPage
  }
  return Success(items)
}

export async function getProjectVersions(
  repository: DataHubRepository,
  options: GitLabRequestOptions = {},
): Promise<Result<ArcRepositoryVersion[]>> {
  if (!validIdentifier(repository.projectPath)) return Failure('A DataHub project path is required.')
  const resource = `projects/${encodeURIComponent(repository.projectPath)}`
  const [releases, tags] = await Promise.all([
    allPages(repository.source, `${resource}/releases`, new URLSearchParams({ order_by: 'released_at', sort: 'desc' }), options, isRelease, 'release'),
    allPages(repository.source, `${resource}/repository/tags`, new URLSearchParams({ order_by: 'updated', sort: 'desc' }), options, isTag, 'tag'),
  ])
  if (releases.success === false) return Failure(releases.error)
  if (tags.success === false) return Failure(tags.error)

  const projectUrl = dataHubRepositoryUrl(repository)
  const versions: ArcRepositoryVersion[] = releases.value.map((release) => ({
    tag: release.tag_name,
    name: release.name || release.tag_name,
    kind: 'release',
    description: release.description || undefined,
    date: release.released_at,
    commit: release.commit?.id,
    url: `${projectUrl}/-/releases/${encodeURIComponent(release.tag_name)}`,
  }))
  const releasedTags = new Set(versions.map((version) => version.tag))
  for (const tag of tags.value) {
    if (releasedTags.has(tag.name)) continue
    versions.push({
      tag: tag.name,
      name: tag.name,
      kind: 'tag',
      description: tag.message || undefined,
      date: tag.created_at || tag.commit.committed_date,
      commit: tag.commit.id,
      url: `${projectUrl}/-/tags/${encodeURIComponent(tag.name)}`,
    })
  }
  versions.sort((a, b) => (Date.parse(b.date ?? '') || 0) - (Date.parse(a.date ?? '') || 0))
  return Success(versions)
}

export async function getArcRepositoryOverview(
  repository: DataHubRepository,
  options: GitLabRequestOptions = {},
): Promise<Result<ArcRepositoryOverview>> {
  const [versions, project] = await Promise.all([
    getProjectVersions(repository, options),
    getProject(repository.source, repository.projectPath, options),
  ])
  if (versions.success === false) return Failure(versions.error)
  const release = versions.value.find((version) => version.kind === 'release')
  const archiveSize = release
    ? await getProjectArchiveSize(repository, release.commit ?? release.tag, options)
    : undefined
  const owner = project.success === true ? project.value.owner ?? project.value.namespace : undefined
  return Success({
    versions: versions.value,
    latestReleaseArchiveSizeBytes: archiveSize?.success === true ? archiveSize.value : undefined,
    visibility: project.success === true ? project.value.visibility : undefined,
    owner: owner ? { name: owner.name, url: owner.web_url } : undefined,
  })
}

export async function getProjectArchiveSize(
  repository: DataHubRepository,
  ref: string,
  options: GitLabRequestOptions = {},
): Promise<Result<number | undefined>> {
  const url = new URL(`${repository.source.replace(/\/+$/, '')}/api/v4/projects/${encodeURIComponent(repository.projectPath)}/repository/archive.zip`)
  url.searchParams.set('sha', ref)
  url.searchParams.set('include_lfs_blobs', 'true')
  const headers = new Headers()
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`)
  try {
    const response = await (options.fetchCall ?? fetch)(url, {
      method: 'HEAD', headers, signal: options.signal, credentials: 'omit', redirect: 'error',
    })
    if (!response.ok) return Failure(`Archive size could not be determined (${response.status}).`)
    const size = Number(response.headers.get('content-length'))
    // Generated GitLab archives can report zero for HEAD even when the ZIP is nonempty.
    const isArchive = /application\/(zip|octet-stream|x-zip-compressed)/i.test(response.headers.get('content-type') ?? '')
    return Success(isArchive && Number.isSafeInteger(size) && size > 0 ? size : undefined)
  } catch {
    return Failure('Archive size could not be determined.')
  }
}
