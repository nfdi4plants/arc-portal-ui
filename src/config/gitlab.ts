export const referenceGitLab = {
  source: 'https://git.nfdi4plants.org',
  exploreUrl: 'https://git.nfdi4plants.org/explore/projects/active',
} as const

export interface DataHub {
  id: string
  name: string
  source: string
}

export const dataHubs: DataHub[] = [
  { id: 'nfdi4plants', name: 'DataPLANT', source: referenceGitLab.source },
]

/** Only the reference DataHUB shares the portal login. */
export function isReferenceHub(hub: DataHub) { return hub.source === referenceGitLab.source }
