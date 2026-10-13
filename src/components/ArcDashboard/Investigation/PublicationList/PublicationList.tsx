import { Link, Text } from '@primer/react'
import { MetadataList } from '../Primitive Components'
import type { PublicationMetadata } from '../types'

function publicationState(status?: string) {
  const value = status?.trim().toLowerCase()
  if (value === 'published') return { symbol: '✓', kind: 'published' }
  if (value === 'draft' || value === 'unpublished') return { symbol: '✎', kind: 'draft' }
  if (value === 'submitted' || value === 'under review' || value === 'accepted' || value === 'in press') {
    return { symbol: '◷', kind: 'pending' }
  }
  return { symbol: '?', kind: 'unknown' }
}

export function PublicationList({ publications, showHeading = true, description }: {
  publications: PublicationMetadata[]
  showHeading?: boolean
  description?: string
}) {
  return (
    <MetadataList
      title="Publications"
      items={publications}
      getKey={(publication) => publication.key}
      showHeading={showHeading}
      description={description}
      emptyText="No publications in this ARC."
      listClassName="publication-list"
      renderItem={(publication) => {
        const state = publicationState(publication.status)
        const statusLabel = `Publication status: ${publication.status ?? 'Not specified'}`
        return (
          <>
            <div className="publication-title-row">
              {publication.url ? (
                <Link href={publication.url} target="_blank" rel="noreferrer">
                  {publication.title}
                </Link>
              ) : (
                <Text as="span">{publication.title}</Text>
              )}
              <span className="publication-state" data-state={state.kind} role="img" aria-label={statusLabel} title={statusLabel}>
                {state.symbol}
              </span>
            </div>
            {publication.authors && <small>{publication.authors}</small>}
            {publication.doi && <small>DOI: {publication.doi}</small>}
          </>
        )
      }}
    />
  )
}
