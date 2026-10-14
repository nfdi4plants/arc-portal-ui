import type { ProvenanceIndex } from '../../../../arc/provenance/types'
import { Dashlet, type DashletProps } from '../../../DashboardWindow'
import { ProvenanceExplorer } from '../ProvenanceExplorer'
import './graphviewDashlet.css'

export type GraphviewDashletProps = Omit<DashletProps, 'children'> & { index: ProvenanceIndex }

export function GraphviewDashlet({
  index,
  height = 'calc(var(--dashboard-window-height, 100dvh) * 2 / 3)',
  className,
  label,
  ...props
}: GraphviewDashletProps) {
  return (
    <Dashlet {...props} label={label ?? props.title ?? 'Provenance'} height={height} className={`graphview-dashlet${className ? ` ${className}` : ''}`}>
      <ProvenanceExplorer index={index} embedded />
    </Dashlet>
  )
}
