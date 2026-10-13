import { Heading, Link, Stack, Text } from '@primer/react'
import type { ExternalLink } from '../types'

export function GithubLinkList({ links }: { links: ExternalLink[] }) {
  return (
    <section className="metadata-card" aria-labelledby="github-heading">
      <Heading as="h2" id="github-heading" className="metadata-card-heading">
        GitHub links
      </Heading>
      {links.length > 0 ? (
        <Stack as="ul" gap="normal" className="github-link-list">
          {links.map((link) => (
            <li key={link.url}>
              <Link href={link.url} target="_blank" rel="noreferrer">
                {link.name}
              </Link>
            </li>
          ))}
        </Stack>
      ) : (
        <Text as="p" className="empty-state">No GitHub links in this ARC.</Text>
      )}
    </section>
  )
}
