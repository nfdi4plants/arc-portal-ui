import type { AnnotationCategory, DatasetKind } from '../../../../arc/provenance/types'

// Generic input of the graph canvas. The canvas knows nothing about ARCs:
// the explorer maps provenance query results onto these shapes.

export type CanvasColor = DatasetKind | 'neutral'

export interface CanvasPill {
  key: string
  // 'property' pills are "name: value unit" with a category color,
  // 'process' pills name a process, 'count' pills show a bare number or text.
  kind: 'property' | 'process' | 'count'
  name?: string
  value: string | null
  unit?: string | null
  category?: AnnotationCategory
}

export interface CanvasNode {
  id: string
  title: string
  subtitle?: string
  color: CanvasColor
  dashed?: boolean
  mono?: boolean
  selected?: boolean
  emphasized?: boolean
  pills?: CanvasPill[]
  tooltip?: string
  ariaLabel: string
  // Nodes that can't be clicked render without button semantics.
  clickable?: boolean
}

export interface CanvasEdge {
  id: string
  from: string
  to: string
  color: CanvasColor
  highlighted?: boolean
  // Always visible on the edge.
  pills: CanvasPill[]
  // Hidden behind a "+N" pill until the user expands the edge.
  morePills?: CanvasPill[]
  tooltip?: string
}

export interface GraphCanvasProps {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  ariaLabel: string
  onNodeClick?: (id: string) => void
  // Scroll this node into the center after layout (used by the lineage view).
  centerNodeId?: string
  // Changing it resets expanded edges and the scroll position (a new view).
  resetKey: string
}
