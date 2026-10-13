import crateJson from '../../../public/sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json?raw'
import { dataHubRepositoryUrl, type ArcRepositoryOverview, type ArcRepositoryVersion, type DataHubRepository } from '../../api/gitlab'
import type { ArcSource } from '../../arc/types'
import { referenceGitLab } from '../../config/gitlab'

export const talinumArcJson = crateJson

export const talinumArcSource: ArcSource = {
  key: 'storybook:facultative-cam-in-talinum',
  label: 'Facultative CAM in Talinum',
  fetchROCrate: () => Promise.resolve(crateJson),
}

export const talinumRepository: DataHubRepository = {
  source: referenceGitLab.source,
  projectPath: 'brilator/Facultative-CAM-in-Talinum',
}

const projectUrl = dataHubRepositoryUrl(talinumRepository)

// Example repository metadata for Storybook; no DataHub requests are made.
const firstRelease: ArcRepositoryVersion = {
  tag: 'v1.0.0',
  name: 'Talinum release 1.0',
  kind: 'release',
  description: 'Initial ARC release with investigation metadata and analysis tables.',
  date: '2025-06-12T10:00:00Z',
  commit: '8fbf1705a09681df9e02e5b1b0c7685e85f405fd',
  archiveSizeBytes: 24 * 1024 * 1024,
  url: `${projectUrl}/-/releases/v1.0.0`,
}

export const publicTalinumDataHubData: ArcRepositoryOverview = {
  visibility: 'public',
  owner: { name: 'Dominik Brilhaus', url: `${referenceGitLab.source}/brilator` },
  latestReleaseArchiveSizeBytes: 32 * 1024 * 1024,
  versions: [
    {
      tag: 'v2.0.0',
      name: 'Talinum release 2.0',
      kind: 'release',
      description: 'Updated annotations, curated publications, and validated analysis workflows.',
      date: '2026-09-15T10:00:00Z',
      commit: '03bdc8f1c6a6499b83592a0b467ec43a86e8ab97',
      archiveSizeBytes: 32 * 1024 * 1024,
      url: `${projectUrl}/-/releases/v2.0.0`,
    },
    firstRelease,
    {
      tag: 'draft-annotations',
      name: 'draft-annotations',
      kind: 'tag',
      description: 'Draft annotation tables prepared before the first release.',
      date: '2025-05-20T10:00:00Z',
      commit: '12f84d6801d013193f6a1f9274d1e6f8c7b5ab31',
      archiveSizeBytes: 20 * 1024 * 1024,
      url: `${projectUrl}/-/tags/draft-annotations`,
    },
  ],
}

export const privateTalinumDataHubData: ArcRepositoryOverview = {
  ...publicTalinumDataHubData,
  visibility: 'private',
  latestReleaseArchiveSizeBytes: firstRelease.archiveSizeBytes,
  versions: [firstRelease],
}
