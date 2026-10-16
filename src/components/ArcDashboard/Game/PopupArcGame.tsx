import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { Arcade, ArcadeBanner } from '@arc-rdg/arcade/react'
import { PopupDashlet, type PopupDashletProps } from '../../PopupDashlet'

export type PopupArcGameProps = Omit<PopupDashletProps, 'children' | 'title' | 'description'> & {
  index?: ProvenanceIndex
  arcTitle: string
}

/** The game as a popup dashlet. It starts as a compact tile showing the ARCade banner and fills the dashboard when expanded. */
export function PopupArcGame({ index, arcTitle, symbol, ...props }: PopupArcGameProps) {
  if (!index) return null
  return (
    <PopupDashlet
      symbol={props.expandOnClick === false ? undefined : symbol ?? <ArcadeBanner />}
      {...props}
      title="ARCade"
      description="Play a short run through the provenance of this ARC."
    >
      <Arcade title={arcTitle} provenance={index} />
    </PopupDashlet>
  )
}
