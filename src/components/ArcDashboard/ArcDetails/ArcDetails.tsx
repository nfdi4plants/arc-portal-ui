import { dataHubRepositoryUrl, type ArcRepositoryOverview, type DataHubRepository } from '../../../api/gitlab'
import { InvestigationHeader } from '../Investigation/InvestigationHeader'
import type { ExternalLink, InvestigationMetadata } from '../Investigation/types'
import '../Investigation/investigation.css'
import './arcDetails.css'

export interface ArcDetailsProps {
  metadata: Pick<InvestigationMetadata, 'title'>
  repository?: DataHubRepository
  dataHubLinks?: ExternalLink[]
  dataHubData?: ArcRepositoryOverview
}

export function ArcDetails({ metadata, repository, dataHubLinks, dataHubData }: ArcDetailsProps) {
  const links = new Map((dataHubLinks ?? []).map((link) => [link.url, link]))
  if (repository) {
    const url = dataHubRepositoryUrl(repository)
    links.set(url, { name: repository.projectPath, url })
  }
  const latestRelease = dataHubData?.versions.find((version) => version.kind === 'release')
  const releaseLink = latestRelease
    ? { name: latestRelease.tag, url: latestRelease.url }
    : repository ? { name: 'View releases', url: `${dataHubRepositoryUrl(repository)}/-/releases` } : undefined

  return (
    <div className="arc-details">
      <InvestigationHeader
        title={metadata.title}
        visibility={dataHubData?.visibility}
        owner={dataHubData?.owner}
        dataHubLinks={[...links.values()]}
        releaseLink={releaseLink}
        archiveSizeBytes={latestRelease?.archiveSizeBytes ?? dataHubData?.latestReleaseArchiveSizeBytes}
      />
    </div>
  )
}
