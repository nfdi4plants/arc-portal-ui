import { CounterLabel, Heading, Text } from '@primer/react'
import { useId, type ReactNode } from 'react'

export interface MetadataListProps<T> {
  title: string
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  emptyText: string
  description?: string
  showHeading?: boolean
  listClassName?: string
}

export function MetadataList<T>({ title, items, getKey, renderItem, emptyText, description, showHeading = true, listClassName }: MetadataListProps<T>) {
  const headingId = useId()

  return (
    <section className="metadata-card" aria-labelledby={showHeading ? headingId : undefined} aria-label={showHeading ? undefined : title}>
      {showHeading && (
        <Heading as="h2" id={headingId} className="metadata-card-heading">
          {title} <CounterLabel>{items.length}</CounterLabel>
        </Heading>
      )}
      {description && <Text as="p" className="metadata-card-description">{description}</Text>}
      {items.length > 0 ? (
        <ul className={`metadata-list ${listClassName ?? ''}`}>
          {items.map((item) => <li key={getKey(item)}>{renderItem(item)}</li>)}
        </ul>
      ) : (
        <Text as="p" className="empty-state">{emptyText}</Text>
      )}
    </section>
  )
}
