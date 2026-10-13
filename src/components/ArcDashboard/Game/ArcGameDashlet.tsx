import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { Dashlet, type DashletProps } from '../../DashboardWindow'
import ArcGame from './ArcGame'
import './arcGameDashlet.css'

export type ArcGameDashletProps = Omit<DashletProps, 'children'> & { index: ProvenanceIndex; arcTitle: string }

// The start screen is part of the page. ArcGame loads Phaser with a dynamic import when the run starts.
export function ArcGameDashlet({
  index,
  arcTitle,
  height = 'calc(var(--dashboard-window-height, 100dvh) * 2 / 3)',
  className,
  label,
  ...props
}: ArcGameDashletProps) {
  return (
    <Dashlet {...props} label={label ?? props.title ?? 'ARC Mage'} height={height} className={`arc-game-dashlet${className ? ` ${className}` : ''}`}>
      <ArcGame index={index} arcTitle={arcTitle} />
    </Dashlet>
  )
}
