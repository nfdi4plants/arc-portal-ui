import { Heading, Label, Link, Text } from '@primer/react'
import type { ExternalLink } from '../types'
import { formatBytes } from '../../../../util/formatBytes'
import type { GitLabVisibility } from '../../../../types/gitlab'

export function InvestigationHeader(props: {
  title: string
  label?: string
  dataHubLinks?: ExternalLink[]
  releaseLink?: ExternalLink
  archiveSizeBytes?: number
  visibility?: GitLabVisibility
  owner?: { name: string; url?: string }
}) {
  const isPublic = props.visibility === 'public'
  const visibilityLabel = isPublic ? 'Public ARC' : props.visibility === 'internal' ? 'Internal ARC' : props.visibility === 'private' ? 'Private ARC' : 'ARC visibility unknown'

  return (
    <header className="investigation-header investigation-header-layout">
      <div className="investigation-header-main">
        <Label variant="secondary">{props.label ?? 'Investigation'}</Label>
        <Heading as="h1" className="investigation-title">
          {props.title}
        </Heading>
        {!!props.dataHubLinks?.length && (
          <nav className="investigation-header-links" aria-label="DataHub links">
            <Text as="span">DataHub</Text>
            <ul>
              {props.dataHubLinks.map((link) => (
                <li key={link.url}>
                  <Link href={link.url} target="_blank" rel="noreferrer">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        {props.releaseLink && (
          <nav className="investigation-header-links investigation-release" aria-label="ARC release">
            <Text as="span">Release</Text>
            <Link href={props.releaseLink.url} target="_blank" rel="noreferrer">
              {props.releaseLink.name}
            </Link>
          </nav>
        )}
      </div>
      <aside className="investigation-header-meta" aria-label="ARC ownership and visibility">
        <span className="investigation-visibility" data-visibility={props.visibility ?? 'unknown'} role="img" aria-label={visibilityLabel} title={visibilityLabel}>
          {props.visibility ? (
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {isPublic ? (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a18 18 0 0 1 0 18M12 3a18 18 0 0 0 0 18" />
                </>
              ) : (
                <>
                  <rect x="5" y="10" width="14" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v3" />
                </>
              )}
            </svg>
          ) : '?'}
        </span>
        {props.owner ? (
          <div className="investigation-owner">
            <Text as="span" className="investigation-meta-label">Owner</Text>
            {props.owner.url ? <Link href={props.owner.url} target="_blank" rel="noreferrer">{props.owner.name}</Link> : <Text as="span">{props.owner.name}</Text>}
          </div>
        ) : (
          <Text as="small" className="investigation-owner investigation-owner-unavailable">Owner: unavailable</Text>
        )}
        {(props.releaseLink || props.archiveSizeBytes !== undefined) && (
          <Text as="small" className="investigation-archive-size">
            {props.archiveSizeBytes === undefined ? 'ARC size: unavailable' : `ARC size: ${formatBytes(props.archiveSizeBytes)}`}
          </Text>
        )}
      </aside>
    </header>
  )
}
