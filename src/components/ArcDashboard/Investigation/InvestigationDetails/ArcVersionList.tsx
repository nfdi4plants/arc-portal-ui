import { CounterLabel, Heading, Label, Link, Text } from '@primer/react'
import { useId } from 'react'
import type { ArcRepositoryOverview, ArcRepositoryVersion } from '../../../../api/gitlab'
import { formatBytes } from '../../../../util/formatBytes'

function ArcVersionRow({ version, archiveSizeBytes }: {
  version: ArcRepositoryVersion
  archiveSizeBytes?: number
}) {
  return (
    <li>
      <div className="investigation-version-heading">
        <Link href={version.url} target="_blank" rel="noreferrer">{version.name}</Link>
        <Label variant="secondary">{version.kind === 'release' ? 'Release' : 'Tag'}</Label>
        {version.date && <time dateTime={version.date}>{version.date.split('T')[0]}</time>}
      </div>
      <div className="investigation-version-reference">
        <Text as="p">{version.tag}{version.commit && <> · <code>{version.commit.slice(0, 8)}</code></>}</Text>
        <Text as="small" className="investigation-version-size">
          {archiveSizeBytes === undefined ? 'Archive size unavailable' : `Archive size: ${formatBytes(archiveSizeBytes)}`}
        </Text>
      </div>
      {version.description && <Text as="p" className="investigation-version-description">{version.description}</Text>}
    </li>
  )
}

export function ArcVersionList({ dataHubData }: { dataHubData?: ArcRepositoryOverview }) {
  const headingId = useId()
  const latestReleaseTag = dataHubData?.versions.find((version) => version.kind === 'release')?.tag

  return (
    <section className="metadata-card" aria-labelledby={headingId}>
      <Heading as="h2" id={headingId} className="metadata-card-heading">
        Versions {dataHubData && <CounterLabel>{dataHubData.versions.length}</CounterLabel>}
      </Heading>
      <Text as="p" className="investigation-versions-intro">
        Releases and tags published for this ARC on the DataHub.
      </Text>
      {!dataHubData ? (
        <Text as="p" className="empty-state">Version information unavailable.</Text>
      ) : dataHubData.versions.length > 0 ? (
        <ul className="investigation-version-list">
          {dataHubData.versions.map((version) => (
            <ArcVersionRow
              key={version.tag}
              version={version}
              archiveSizeBytes={version.archiveSizeBytes ?? (version.tag === latestReleaseTag ? dataHubData.latestReleaseArchiveSizeBytes : undefined)}
            />
          ))}
        </ul>
      ) : (
        <Text as="p" className="empty-state">No releases or tags have been published for this ARC yet.</Text>
      )}
    </section>
  )
}
