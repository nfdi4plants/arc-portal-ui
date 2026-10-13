import { Text } from '@primer/react'
import { useState } from 'react'
import { ShowMoreButton } from '../ShowMoreButton'

export interface ExpandableTextProps {
  children: string
  previewLength?: number
  className?: string
}

export function ExpandableText({ children, previewLength = 100, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = children.length > previewLength
  const visibleText = canExpand && !expanded ? `${children.slice(0, previewLength).trimEnd()}…` : children

  return (
    <div className={className}>
      <Text as="p">{visibleText}</Text>
      {canExpand && <ShowMoreButton expanded={expanded} onToggle={() => setExpanded((current) => !current)} />}
    </div>
  )
}
