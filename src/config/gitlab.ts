import type { GitLabInstance } from '../types/gitlab.ts'

export const referenceGitLab = {
  source: 'https://git.nfdi4plants.org',
  exploreUrl: 'https://git.nfdi4plants.org/explore/projects/active',
} as const

export const defaultDataHub: GitLabInstance = {
  id: 'plantdatahub',
  name: 'PLANTdataHUB (official)',
  url: referenceGitLab.source,
  description: 'The official PLANTdataHUB instance, hosted by the nfdi4plants. Recommended for most users.',
}

export const dataHubCollection = {
  default: defaultDataHub,
  supported: [
    { id: 'plantmicrobe', name: 'gitlab.plantmicrobe.de', url: 'https://gitlab.plantmicrobe.de/' },
  ] satisfies GitLabInstance[],
}

export const availableDataHubs = [dataHubCollection.default, ...dataHubCollection.supported]
