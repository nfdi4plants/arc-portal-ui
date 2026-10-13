import { Link, Stack, Text } from '@primer/react'
import { ExpandableSection } from '../Primitive Components'
import type { PublicationMetadata } from '../types'

export function PublicationList({ publications }: { publications: PublicationMetadata[] }) {
  return (
    <ExpandableSection title="Publications" count={publications.length} variant="card">
        {publications.length > 0 ? (
          <Stack as="ul" gap="normal" className="publication-list">
            {publications.map((publication) => (
              <li key={publication.key}>
                {publication.url ? (
                  <Link href={publication.url} target="_blank" rel="noreferrer">
                    {publication.title}
                  </Link>
                ) : (
                  <Text as="span">{publication.title}</Text>
                )}
                {publication.authors && <small>{publication.authors}</small>}
                {publication.doi && <small>DOI: {publication.doi}</small>}
              </li>
            ))}
          </Stack>
        ) : (
          <Text as="p" className="empty-state">No publications in this ARC.</Text>
        )}
    </ExpandableSection>
  )
}
