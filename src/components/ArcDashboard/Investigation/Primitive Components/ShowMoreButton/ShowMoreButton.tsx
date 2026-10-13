import { Button } from '@primer/react'

export interface ShowMoreButtonProps {
  expanded: boolean
  onToggle: () => void
}

export function ShowMoreButton({ expanded, onToggle }: ShowMoreButtonProps) {
  return (
    <Button
      variant="invisible"
      size="small"
      className="investigation-description-toggle"
      aria-expanded={expanded}
      onClick={onToggle}
    >
      {expanded ? 'Show less' : 'Show more'}
    </Button>
  )
}
