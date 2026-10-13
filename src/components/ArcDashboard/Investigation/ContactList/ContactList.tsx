import { Link, Text } from '@primer/react'
import { MetadataList } from '../Primitive Components'
import type { ContactLocation, ContactMetadata } from '../types'

function locationLabel(location: ContactLocation): string {
  if (location.kind === 'investigation') return 'Investigation'
  return `${location.kind[0].toUpperCase()}${location.kind.slice(1)}: ${location.identifier}`
}

export function ContactList({ contacts, showHeading = true, description }: {
  contacts: ContactMetadata[]
  showHeading?: boolean
  description?: string
}) {
  return (
    <MetadataList
      title="Contacts"
      items={contacts}
      getKey={(contact) => contact.key}
      showHeading={showHeading}
      description={description}
      emptyText="No contacts in this ARC."
      listClassName="contact-list"
      renderItem={(contact) => (
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
      )}
    />
  )
}
