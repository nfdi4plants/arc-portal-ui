import { ActionList } from '@primer/react'
import type { InvestigationMetadata } from '../Investigation/types'
import { investigationDashletTitles, type investigationDetailIds } from '../InvestigationDashlets/investigationDashletOptions'

type DetailId = (typeof investigationDetailIds)[number]
type Entity = { key: string; label: string; details?: string; href?: string; path?: string }

export function InvestigationEntityMenu({ metadata, id, onNavigateFolder }: { metadata: InvestigationMetadata; id: DetailId; onNavigateFolder?: (path: string) => void }) {
  const title = investigationDashletTitles[id]
  if (id === 'description') return (
    <ActionList showDividers>
      <ActionList.Item onSelect={event => event.preventDefault()}>
        {metadata.identifier}
        <ActionList.Description variant="block">{metadata.description ?? 'No description in this ARC.'}</ActionList.Description>
      </ActionList.Item>
      {metadata.githubLinks.map(link => <ActionList.LinkItem key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.name}</ActionList.LinkItem>)}
    </ActionList>
  )

  const entities: Entity[] = id === 'contacts' ? metadata.contacts.map(contact => ({
    key: contact.key,
    label: contact.name,
    href: contact.orcidUrl,
    details: contact.locations.filter(location => location.kind !== 'investigation')
      .map(location => `${location.kind[0].toUpperCase()}${location.kind.slice(1)}: ${location.identifier}`).join('; ') || undefined,
  })) : id === 'publications' ? metadata.publications.map(publication => ({
    key: publication.key,
    label: publication.title,
    href: publication.url,
    details: [publication.authors, publication.doi && `DOI: ${publication.doi}`, `Status: ${publication.status ?? 'Not specified'}`].filter(Boolean).join(' · '),
  })) : metadata[id].map(entity => ({
    key: entity.identifier,
    label: entity.name,
    path: id === 'organizations' ? undefined : `${id}/${entity.identifier}`,
  }))

  return (
    <ActionList showDividers>
      {entities.length ? entities.map(entity => {
        const content = [entity.label, entity.details && <ActionList.Description key="details" variant="block">{entity.details}</ActionList.Description>]
        return entity.href
          ? <ActionList.LinkItem key={entity.key} href={entity.href} target="_blank" rel="noreferrer">{content}</ActionList.LinkItem>
          : <ActionList.Item key={entity.key} onSelect={event => {
            if (entity.path && onNavigateFolder) onNavigateFolder(entity.path)
            else event.preventDefault()
          }}>{content}</ActionList.Item>
      }) : <ActionList.Item onSelect={event => event.preventDefault()}>No {title.toLowerCase()} in this ARC.</ActionList.Item>}
    </ActionList>
  )
}
