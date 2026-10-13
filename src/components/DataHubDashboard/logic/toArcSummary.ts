import type { DataHub } from '../../../config/gitlab.ts'
import type { GitLabGroup, GitLabProject } from '../../../types/gitlab.ts'
import type { ArcSummary, WorkingGroup } from '../../../types/dashboard.ts'

/** Maps top-level group paths to display names. */
export function groupNamesFrom(groups: GitLabGroup[]): Map<string, string> {
  return new Map(groups.filter(group => !group.full_path.includes('/')).map(group => [group.full_path, group.name]))
}

function workingGroup(project: GitLabProject, hub: DataHub, groupNames: Map<string, string>): WorkingGroup {
  if (project.namespace?.kind === 'user') {
    return { key: `${hub.id}/~personal`, label: 'Personal', hubId: hub.id, personal: true }
  }
  const top = (project.namespace?.full_path ?? project.path_with_namespace).split('/')[0]
  return { key: `${hub.id}/${top}`, label: groupNames.get(top) ?? top, hubId: hub.id, personal: false }
}

/** `anonymous` means the request carried no token, so a project without `visibility` must be public. */
export function toArcSummary(project: GitLabProject, hub: DataHub, groupNames: Map<string, string>, anonymous: boolean): ArcSummary {
  const visibility = project.visibility ?? (anonymous ? 'public' : 'private')
  const host = new URL(hub.source).host
  return {
    key: `${host}/${project.path_with_namespace}${project.default_branch ? `@${project.default_branch}` : ''}`,
    projectId: project.id,
    hubId: hub.id,
    title: project.name,
    description: project.description ?? '',
    group: workingGroup(project, hub, groupNames),
    access: visibility === 'public' ? 'public' : 'private',
    createdAt: project.created_at ?? project.last_activity_at ?? '',
    lastActivityAt: project.last_activity_at ?? project.created_at ?? '',
    topics: project.topics ?? [],
    stars: project.star_count,
    url: project.web_url,
  }
}
