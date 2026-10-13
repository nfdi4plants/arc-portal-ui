import { describe, expect, it } from 'vitest'
import type {
  Annotation,
  AnnotationCategory,
  DetailEdge,
  DetailNode,
  GroupGraph,
  IoGroup,
  IoKind,
  LineageGraph,
  ProcessDetailGraph,
  ProvenanceProcess,
} from '../../src/arc/provenance/types'
import {
  datasetsToCanvas,
  detailToCanvas,
  groupsToCanvas,
  limitLineage,
  lineageToCanvas,
  processesToCanvas,
} from '../../src/components/ArcDashboard/Provenance/ProvenanceExplorer/toCanvas'

function ann(category: AnnotationCategory, name: string, value: string | null, unit: string | null = null): Annotation {
  return { name, value, unit, accession: null, category }
}

function detailNode(id: string, kind: IoKind, annotations: Annotation[] = [], emphasized = false): DetailNode {
  return { id, kind, annotations, emphasized }
}

function detailEdge(id: string, from: string, to: string, processKey: string, overrides: Partial<DetailEdge> = {}): DetailEdge {
  return {
    id,
    from,
    to,
    processKey,
    processName: processKey,
    datasetKind: 'assay',
    differing: [],
    shared: [],
    ...overrides,
  }
}

const process: ProvenanceProcess = {
  key: 'assays/a/::step',
  name: 'step',
  datasetId: 'assays/a/',
  rowIds: [],
  signatures: [],
  inputGroups: [],
  outputGroups: [],
  groupEdges: [],
}

const group: IoGroup = { id: 'g1', side: 'inputs', label: 'Inputs A', nodeIds: [], signatureIds: [] }

describe('datasetsToCanvas', () => {
  it('shows the identifier, colors by kind and counts the shared nodes on the edge', () => {
    const canvas = datasetsToCanvas({
      nodes: [
        { id: 'studies/s/', kind: 'study', label: 's' },
        { id: 'assays/a/', kind: 'assay', label: 'a' },
      ],
      edges: [{ id: 'e1', from: 'studies/s/', to: 'assays/a/', sharedNodeIds: ['x', 'y', 'z'] }],
    })

    expect(canvas.nodes[0]).toMatchObject({ id: 'studies/s/', title: 's', color: 'study', tooltip: 's (study)' })
    expect(canvas.nodes[0].ariaLabel).toContain('study')
    expect(canvas.nodes[0].subtitle).toBeUndefined()
    expect(canvas.edges).toEqual([
      {
        id: 'e1',
        from: 'studies/s/',
        to: 'assays/a/',
        color: 'neutral',
        pills: [{ key: 'count', kind: 'count', value: '3', tooltip: '3 shared inputs and outputs' }],
      },
    ])
  })
})

describe('processesToCanvas', () => {
  it('writes the row count on own processes and the dataset on external ones', () => {
    const canvas = processesToCanvas({
      dataset: { id: 'assays/a/', kind: 'assay', identifier: 'a' },
      nodes: [
        { key: 'k1', label: 'step', datasetId: 'assays/a/', datasetKind: 'assay', datasetLabel: 'a', external: false, rowCount: 1 },
        { key: 'k2', label: 'other', datasetId: 'assays/a/', datasetKind: 'assay', datasetLabel: 'a', external: false, rowCount: 6 },
        { key: 'k3', label: 'far', datasetId: 'runs/r/', datasetKind: 'run', datasetLabel: 'r', external: true, rowCount: 2 },
      ],
      edges: [{ id: 'e1', from: 'k1', to: 'k3', sharedNodeIds: ['x'] }],
    })

    expect(canvas.nodes.map((node) => node.subtitle)).toEqual(['1 row', '6 rows', 'r'])
    expect(canvas.nodes.map((node) => node.dashed)).toEqual([undefined, undefined, true])
    expect(canvas.nodes[2]).toMatchObject({ title: 'far', color: 'run' })
    expect(canvas.edges[0]).toMatchObject({
      color: 'neutral',
      pills: [{ kind: 'count', value: '1', tooltip: '1 shared input or output' }],
    })
  })
})

describe('groupsToCanvas', () => {
  const graph: GroupGraph = {
    process,
    datasetKind: 'assay',
    nodes: [
      { id: 'g1', side: 'inputs', label: 'Inputs A', kindCounts: { data: 2, sample: 3 } },
      { id: 'g2', side: 'outputs', label: 'Outputs A', kindCounts: { sample: 1 } },
      { id: 'g3', side: 'outputs', label: 'Outputs B', kindCounts: { data: 1, source: 2, material: 1 } },
    ],
    edges: [{ id: 'e1', from: 'g1', to: 'g2', differing: [ann('parameter', 'temp', '40', 'C')], shared: [ann('protocol', 'Protocol', 'p1')] }],
  }

  it('lists the kinds in IoKind order and pluralizes all but data', () => {
    const canvas = groupsToCanvas(graph)

    expect(canvas.nodes.map((node) => node.title)).toEqual(['Inputs A', 'Outputs A', 'Outputs B'])
    expect(canvas.nodes.map((node) => node.subtitle)).toEqual([
      '3 samples · 2 data',
      '1 sample',
      '2 sources · 1 material · 1 data',
    ])
    expect(canvas.nodes[0].color).toBe('assay')
  })

  it('puts the differing annotations on the edge and the shared ones behind the more pill', () => {
    const [edge] = groupsToCanvas(graph).edges

    expect(edge.color).toBe('assay')
    expect(edge.pills).toMatchObject([{ kind: 'property', name: 'temp', value: '40', unit: 'C', category: 'parameter' }])
    expect(edge.morePills).toMatchObject([{ kind: 'property', name: 'Protocol', value: 'p1', category: 'protocol' }])
  })
})

describe('detailToCanvas', () => {
  const species = ann('characteristic', 'species', 'Talinum')
  const detail = (nodes: DetailNode[], edges: DetailEdge[] = []): ProcessDetailGraph => ({ process, group, nodes, edges })

  it('shows the kind only in a graph with several kinds', () => {
    const mixed = detailToCanvas(detail([detailNode('a', 'sample'), detailNode('b', 'data')]))
    const single = detailToCanvas(detail([detailNode('a', 'sample'), detailNode('b', 'sample')]))

    expect(mixed.nodes.map((node) => node.subtitle)).toEqual(['sample', 'data'])
    expect(single.nodes.map((node) => node.subtitle)).toEqual([undefined, undefined])
  })

  it('moves annotations that every node carries into the tooltips', () => {
    const tissue = (value: string) => ann('characteristic', 'tissue', value)
    const canvas = detailToCanvas(
      detail([detailNode('a', 'sample', [species, tissue('leaf')]), detailNode('b', 'sample', [species, tissue('root')])]),
    )

    const [a, b] = canvas.nodes
    expect(a.pills).toMatchObject([{ kind: 'property', name: 'tissue', value: 'leaf' }])
    expect(b.pills).toMatchObject([{ name: 'tissue', value: 'root' }])
    expect(a.tooltip).toBe('a (sample): Characteristic · species: Talinum')
    expect(b.tooltip).toBe('b (sample): Characteristic · species: Talinum')
  })

  it('marks the emphasized nodes, sets monospace titles and adds no process pill', () => {
    const canvas = detailToCanvas(
      detail(
        [detailNode('a', 'sample', [], true), detailNode('b', 'sample')],
        [detailEdge('e1', 'a', 'b', 'p1', { differing: [ann('parameter', 'temp', '40')], shared: [ann('protocol', 'Protocol', 'x')] })],
      ),
    )

    expect(canvas.nodes.map((node) => [node.mono, node.emphasized])).toEqual([[true, true], [true, false]])
    expect(canvas.edges[0].color).toBe('assay')
    expect(canvas.edges[0].pills).toHaveLength(1)
    expect(canvas.edges[0].pills[0].kind).toBe('property')
    expect(canvas.edges[0].morePills).toHaveLength(1)
  })
})

describe('lineageToCanvas', () => {
  const lineage = (edges: DetailEdge[]): LineageGraph => ({
    nodeId: 'b',
    nodes: [detailNode('a', 'sample'), detailNode('b', 'sample', [], true), detailNode('c', 'sample')],
    edges,
  })

  it('puts a process pill first on every edge only when several processes appear', () => {
    const differing = [ann('parameter', 'temp', '40')]
    const several = lineageToCanvas(
      lineage([detailEdge('e1', 'a', 'b', 'p1', { differing }), detailEdge('e2', 'b', 'c', 'p2')]),
    )
    const one = lineageToCanvas(lineage([detailEdge('e1', 'a', 'b', 'p1', { differing }), detailEdge('e2', 'b', 'c', 'p1')]))

    expect(several.edges[0].pills.map((pill) => pill.kind)).toEqual(['process', 'property'])
    expect(several.edges[0].pills[0]).toMatchObject({ value: 'p1', tooltip: 'Process p1' })
    expect(several.edges[1].pills.map((pill) => pill.kind)).toEqual(['process'])
    expect(one.edges.flatMap((edge) => edge.pills.map((pill) => pill.kind))).toEqual(['property'])
  })

  it('highlights the edges of the selected process and marks the selected node', () => {
    const canvas = lineageToCanvas(lineage([detailEdge('e1', 'a', 'b', 'p1'), detailEdge('e2', 'b', 'c', 'p2')]), 'p2')

    expect(canvas.edges.map((edge) => edge.highlighted)).toEqual([false, true])
    expect(canvas.nodes.map((node) => node.selected)).toEqual([false, true, false])
    expect(canvas.centerNodeId).toBe('b')
  })
})

describe('limitLineage', () => {
  // A chain n0 -> n1 -> ... -> n(length - 1) with the selected node somewhere in it.
  const chain = (length: number, nodeId: string): LineageGraph => ({
    nodeId,
    nodes: Array.from({ length }, (_, i) => detailNode(`n${i}`, 'sample', [], `n${i}` === nodeId)),
    edges: Array.from({ length: length - 1 }, (_, i) => detailEdge(`e${i}`, `n${i}`, `n${i + 1}`, 'p1')),
  })

  it('keeps a graph within the limit unchanged', () => {
    const graph = chain(80, 'n0')

    expect(limitLineage(graph)).toEqual({ graph, total: 80 })
  })

  it('keeps the 80 nodes nearest to the selected node and the edges between them', () => {
    const { graph, total } = limitLineage(chain(120, 'n60'))

    expect(total).toBe(120)
    expect(graph.nodes).toHaveLength(80)
    const ids = new Set(graph.nodes.map((node) => node.id))
    // n20 and n100 are equally far from n60, and the earlier one in the graph order stays.
    expect([...ids].sort()).toEqual(Array.from({ length: 80 }, (_, i) => `n${i + 20}`).sort())
    expect(graph.edges).toHaveLength(79)
    expect(graph.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to))).toBe(true)
  })
})
