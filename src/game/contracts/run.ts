import type { Annotation, DatasetKind, IoKind, ProvenanceIndex } from '../../arc/provenance/types'

export interface RunNode {
  id: string
  kind: IoKind
  annotations: Annotation[]
}

// One step of the path, from one node to the next.
export interface Segment {
  index: number
  fromNodeId: string
  toNodeId: string
  processKey: string
  processName: string
  datasetId: string
  datasetKind: DatasetKind
  // Every ISA annotation of the row(s) linking the two nodes: step annotations, input
  // characteristics and output factors. One mob each.
  annotations: Annotation[]
  quality: number
  telegraphMs: number
}

export interface RunPlan {
  seed: string
  arcTitle: string
  // nodes[0] is the start input, nodes[i + 1] the boss after segments[i].
  nodes: RunNode[]
  segments: Segment[]
}

export interface StartCandidate {
  nodeId: string
  pathLength: number
}

// Sorted by path length, longest first.
export type ListStartCandidates = (index: ProvenanceIndex) => StartCandidate[]
// Null when the ARC has no path at all.
export type PlanRun = (index: ProvenanceIndex, arcTitle: string, seed: string) => RunPlan | null
export type SegmentQuality = (annotations: Annotation[]) => number
export type TelegraphMs = (quality: number) => number
