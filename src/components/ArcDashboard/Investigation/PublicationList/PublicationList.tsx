import { CounterLabel, Heading, Link, Stack, Text } from '@primer/react'
import { useId } from 'react'
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

export function PublicationList({ publications }: { publications: PublicationMetadata[] }) {
  const headingId = useId()

  return (
    <section className="metadata-card" aria-labelledby={headingId}>
      <Heading as="h2" id={headingId} className="metadata-card-heading">
        Publications <CounterLabel>{publications.length}</CounterLabel>
      </Heading>
      {publications.length > 0 ? (
        <Stack as="ul" gap="normal" className="publication-list">
          {publications.map((publication) => {
            const state = publicationState(publication.status)
            const statusLabel = `Publication status: ${publication.status ?? 'Not specified'}`
            return (
              <li key={publication.key}>
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
              </li>
            )
          })}
        </Stack>
      ) : (
        <Text as="p" className="empty-state">No publications in this ARC.</Text>
      )}
    </section>
  )
}
