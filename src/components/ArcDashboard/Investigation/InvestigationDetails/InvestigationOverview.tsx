import { Link, Text } from '@primer/react'
import { ExpandableText } from '../Primitive Components'
import type { InvestigationMetadata } from '../types'

export function InvestigationOverview({ metadata, showFullDescription = false }: {
  metadata: Pick<InvestigationMetadata, 'identifier' | 'description' | 'githubLinks'>
  showFullDescription?: boolean
}) {
  return (
    <section className="investigation-overview" aria-label="ARC overview">
      <Text as="p" className="investigation-identifier">{metadata.identifier}</Text>
      {!!metadata.githubLinks.length && (
        <nav className="investigation-header-links" aria-label="GitHub links">
          <Text as="span">GitHub</Text>
          <ul>
            {metadata.githubLinks.map((link) => (
              <li key={link.url}>
                <Link href={link.url} target="_blank" rel="noreferrer">{link.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {metadata.description && (
        showFullDescription ? (
          <div className="investigation-description"><Text as="p">{metadata.description}</Text></div>
        ) : (
          <ExpandableText className="investigation-description">{metadata.description}</ExpandableText>
        )
      )}
    </section>
  )
}
