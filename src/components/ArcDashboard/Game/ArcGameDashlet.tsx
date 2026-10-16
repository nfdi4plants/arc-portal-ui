import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { Dashlet, type DashletProps } from '../../DashboardWindow'
import { Arcade } from '@arc-rdg/arcade/react'
import './arcGameDashlet.css'

export type ArcGameDashletProps = Omit<DashletProps, 'children'> & { index: ProvenanceIndex; arcTitle: string }

// The start screen is part of the page. The ARCade package loads Phaser with a dynamic import when the run starts.
export function ArcGameDashlet({
  index,
  arcTitle,
  height = 'calc(var(--dashboard-window-height, 100dvh) * 2 / 3)',
  className,
  label,
  ...props
}: ArcGameDashletProps) {
  return (
    <Dashlet {...props} label={label ?? props.title ?? 'ARCade'} height={height} className={`arc-game-dashlet${className ? ` ${className}` : ''}`}>
      <Arcade title={arcTitle} provenance={index} />
    </Dashlet>
  )
}
