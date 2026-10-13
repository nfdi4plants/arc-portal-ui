import type { ARC } from '@nfdi4plants/arctrl'
import { buildProvenanceIndex } from '../provenance/buildIndex'
import { datasetGraph, lineage, processDetail, processGraph, processGroups } from '../provenance/queries'
import type {
  DatasetGraph,
  GroupGraph,
  LineageGraph,
  ProcessDetailGraph,
  ProcessGraph,
} from '../provenance/types'

// One selector per detail level of the provenance graph. Each builds the index
// from the ARC, which takes a few milliseconds on the sample, so nothing is cached.
// The selectors with an id return undefined for an id the ARC does not have.
// A component that reads several levels builds the index once with buildProvenanceIndex
// (provenance/buildIndex.ts) and calls the query functions in provenance/queries.ts on it.

export const selectDatasetGraph = (arc: ARC): DatasetGraph => datasetGraph(buildProvenanceIndex(arc))

export const selectProcessGraph = (arc: ARC, datasetId: string): ProcessGraph | undefined =>
  processGraph(buildProvenanceIndex(arc), datasetId)

export const selectProcessGroups = (arc: ARC, processKey: string): GroupGraph | undefined =>
  processGroups(buildProvenanceIndex(arc), processKey)

export const selectProcessDetail = (arc: ARC, groupId: string): ProcessDetailGraph | undefined =>
  processDetail(buildProvenanceIndex(arc), groupId)

export const selectLineage = (arc: ARC, nodeId: string): LineageGraph | undefined =>
  lineage(buildProvenanceIndex(arc), nodeId)
