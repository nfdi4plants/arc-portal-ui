import { CounterLabel, Heading, Link, Stack, Text } from '@primer/react'
import { useId } from 'react'
import type { ContactLocation, ContactMetadata } from '../types'

function locationLabel(location: ContactLocation): string {
  if (location.kind === 'investigation') return 'Investigation'
  return `${location.kind[0].toUpperCase()}${location.kind.slice(1)}: ${location.identifier}`
}

export function ContactList({ contacts, showHeading = true }: { contacts: ContactMetadata[]; showHeading?: boolean }) {
  const headingId = useId()

  return (
    <section className="metadata-card" aria-labelledby={showHeading ? headingId : undefined} aria-label={showHeading ? undefined : 'Contacts'}>
      {showHeading && (
        <Heading as="h2" id={headingId} className="metadata-card-heading">
          Contacts <CounterLabel>{contacts.length}</CounterLabel>
        </Heading>
      )}
      {contacts.length > 0 ? (
        <Stack as="ul" gap="normal" className="contact-list">
          {contacts.map((contact) => (
            <li key={contact.key}>
              <div>
                {contact.orcidUrl ? (
                  <Link href={contact.orcidUrl} target="_blank" rel="noreferrer">
                    {contact.name}
                  </Link>
                ) : (
                  <Text as="span">{contact.name}</Text>
                )}
                {contact.locations.some((location) => location.kind !== 'investigation') && (
                  <Text as="span" className="contact-locations">
                    {' '}[
                    {contact.locations
                      .filter((location) => location.kind !== 'investigation')
                      .map(locationLabel)
                      .join('; ')}
                    ]
                  </Text>
                )}
              </div>
            </li>
          ))}
        </Stack>
      ) : (
        <Text as="p" className="empty-state">No contacts in this ARC.</Text>
      )}
    </section>
  )
}
