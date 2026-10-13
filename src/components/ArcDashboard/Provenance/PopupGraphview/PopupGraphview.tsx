import { Text } from '@primer/react'
import type { ProvenanceIndex } from '../../../../arc/provenance/types'
import { PopupDashlet, type PopupDashletProps } from '../../../PopupDashlet'
import { ProvenanceExplorer } from '../ProvenanceExplorer'
import './popupGraphview.css'

export type PopupGraphviewProps = Omit<PopupDashletProps, 'children' | 'title' | 'description'> & {
  index?: ProvenanceIndex
}

export function PopupGraphview({ index, className, ...props }: PopupGraphviewProps) {
  return (
    <PopupDashlet
      {...props}
      title="Graphview"
      description="Explore connections between datasets, experimental processes, and their inputs and outputs."
      className={`popup-graphview${className ? ` ${className}` : ''}`}
    >
      {index ? <ProvenanceExplorer index={index} embedded /> : <Text as="p">No provenance data available.</Text>}
    </PopupDashlet>
  )
}
