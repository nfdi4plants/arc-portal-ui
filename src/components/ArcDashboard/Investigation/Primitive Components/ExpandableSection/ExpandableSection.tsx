import { Details, Heading, Text } from '@primer/react'
import type { ReactNode } from 'react'

export interface ExpandableSectionProps {
  title: string
  count: number
  variant?: 'card' | 'row'
  children: ReactNode
}

export function ExpandableSection({ title, count, variant = 'row', children }: ExpandableSectionProps) {
  const isCard = variant === 'card'

  return (
    <Details className={isCard ? 'metadata-card metadata-card-expandable' : 'entity-list'}>
      <Details.Summary className={isCard ? 'metadata-card-summary' : 'entity-list-summary'}>
        <span className="entity-list-chevron" aria-hidden="true" />
        {isCard ? (
          <Heading as="h2" className="metadata-card-heading">
            {title} <span className="entity-list-count">({count})</span>
          </Heading>
        ) : (
          <Text as="span" className="entity-list-title">
            {title}
            <span className="entity-list-count"> ({count})</span>
          </Text>
        )}
      </Details.Summary>
      {isCard ? <div className="metadata-card-content">{children}</div> : children}
    </Details>
  )
}
