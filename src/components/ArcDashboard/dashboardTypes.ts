import type { ReactNode } from 'react'
import type { ProvenanceIndex } from '../../arc/provenance/types'
import type { ArcDetailsProps } from './ArcDetails'
import type { InvestigationMetadata } from './Investigation/types'

export type DashboardProps = Omit<ArcDetailsProps, 'metadata'> & { arcJson: string }

export type DashboardContentProps = DashboardProps & {
  metadata: InvestigationMetadata
  provenance?: ProvenanceIndex
  actions?: ReactNode
}
