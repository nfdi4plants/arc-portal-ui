import { Link, Stack, Text } from '@primer/react'
import { ExpandableSection } from '../Primitive Components'
import type { ContactLocation, ContactMetadata } from '../types'

function locationLabel(location: ContactLocation): string {
  if (location.kind === 'investigation') return 'Investigation'
  return `${location.kind[0].toUpperCase()}${location.kind.slice(1)}: ${location.identifier}`
}

export function ContactList({ contacts }: { contacts: ContactMetadata[] }) {
  return (
    <ExpandableSection title="Contacts" count={contacts.length} variant="card">
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
    </ExpandableSection>
  )
}
