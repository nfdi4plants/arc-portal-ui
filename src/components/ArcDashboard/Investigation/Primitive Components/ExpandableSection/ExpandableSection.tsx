import { Details, Text } from '@primer/react'
import type { ReactNode } from 'react'

export interface ExpandableSectionProps {
  title: string
  count: number
  children: ReactNode
}

export function ExpandableSection({ title, count, children }: ExpandableSectionProps) {
  return (
    <Details className="entity-list">
      <Details.Summary className="entity-list-summary">
        <span className="entity-list-chevron" aria-hidden="true" />
        <Text as="span" className="entity-list-title">
          {title}
          <span className="entity-list-count"> ({count})</span>
        </Text>
      </Details.Summary>
      {children}
    </Details>
  )
}
