import { Link, Text } from '@primer/react'
import type { InvestigationMetadata } from '../types'

export function InvestigationDescription({ metadata }: {
  metadata: Pick<InvestigationMetadata, 'identifier' | 'description' | 'githubLinks'>
}) {
  return (
    <section className="investigation-description-view" aria-label="ARC description">
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
      <Text as="p" className="investigation-description">{metadata.description ?? 'No description in this ARC.'}</Text>
    </section>
  )
}
