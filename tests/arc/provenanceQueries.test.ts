import { describe, expect, it } from 'vitest'
import {
  datasetGraph,
  lineage,
  processDetail,
  processGraph,
  processGroups,
  splitSharedAnnotations,
} from '../../src/arc/provenance/queries'
import type {
  Annotation,
  AnnotationCategory,
  IoGroup,
  IoKind,
  ProvenanceDataset,
  ProvenanceIndex,
  ProvenanceNode,
  ProvenanceProcess,
  ProvenanceRow,
} from '../../src/arc/provenance/types'

function ann(category: AnnotationCategory, name: string, value: string | null): Annotation {
  return { name, value, unit: null, accession: null, category }
}

function node(id: string, kind: IoKind, annotations: Annotation[] = []): ProvenanceNode {
  // datasetIds and processKeys are not read by the queries.
  return { id, kind, annotations, datasetIds: [], processKeys: [] }
}

function row(id: string, processKey: string, datasetId: string, inputs: string[], outputs: string[], annotations: Annotation[]): ProvenanceRow {
  return { id, name: id, processKey, datasetId, inputs, outputs, annotations }
}

function group(id: string, side: IoGroup['side'], label: string, nodeIds: string[], signatureIds: string[]): IoGroup {
  return { id, side, label, nodeIds, signatureIds }
}

// A process whose rows all share one signature: one input group, one output group, one group edge.
function uniformProcess(key: string, datasetId: string, rows: ProvenanceRow[]): ProvenanceProcess {
  const signatureId = `${key}#sig`
  const inputGroup = group(`${key}#in`, 'inputs', 'Inputs A', [...new Set(rows.flatMap((r) => r.inputs))], [signatureId])
  const outputGroup = group(`${key}#out`, 'outputs', 'Outputs A', [...new Set(rows.flatMap((r) => r.outputs))], [signatureId])
  const rowIds = rows.map((r) => r.id)
  return {
    key,
    name: key.split(':')[1] ?? key,
    datasetId,
    rowIds,
    signatures: [{ id: signatureId, rowIds, annotations: rows[0].annotations, distinguishing: [] }],
    inputGroups: [inputGroup],
    outputGroups: [outputGroup],
    groupEdges: [{ id: `${key}#e1`, from: inputGroup.id, to: outputGroup.id, signatureId, rowIds }],
  }
}

// Fills every lookup map from the arrays, like the real index builder does.
function buildIndex(parts: {
  datasets: ProvenanceDataset[]
  processes: ProvenanceProcess[]
  rows: ProvenanceRow[]
  nodes: ProvenanceNode[]
}): ProvenanceIndex {
  const producedBy = new Map<string, string[]>()
  const consumedBy = new Map<string, string[]>()
  const push = (map: Map<string, string[]>, nodeId: string, rowId: string) => map.set(nodeId, [...(map.get(nodeId) ?? []), rowId])
  for (const r of parts.rows) {
    r.outputs.forEach((id) => push(producedBy, id, r.id))
    r.inputs.forEach((id) => push(consumedBy, id, r.id))
  }
  const groups = parts.processes.flatMap((p) => [...p.inputGroups, ...p.outputGroups])
  return {
    ...parts,
    datasetById: new Map(parts.datasets.map((d) => [d.id, d])),
    processByKey: new Map(parts.processes.map((p) => [p.key, p])),
    rowById: new Map(parts.rows.map((r) => [r.id, r])),
    nodeById: new Map(parts.nodes.map((n) => [n.id, n])),
    groupById: new Map(groups.map((g) => [g.id, g])),
    producedBy,
    consumedBy,
  }
}

// Study S: sampling makes samples S1, S2 from sources A, B.
// Assay As: extraction S1 -> E1, S2 -> E2, then measurement E1 -> F1 (split), E1 -> F2 (splitless), E2 -> F3 (split).
const protocol = (value: string) => ann('protocol', 'protocol', value)
const split = ann('parameter', 'mode', 'split')
const splitless = ann('parameter', 'mode', 'splitless')
const organism = ann('characteristic', 'organism', 'Talinum')

function fixture(): ProvenanceIndex {
  const sampling = [
    row('s1', 'S:sampling', 'S', ['A'], ['S1'], [protocol('collect')]),
    row('s2', 'S:sampling', 'S', ['B'], ['S2'], [protocol('collect')]),
  ]
  const extraction = [
    row('x1', 'As:extraction', 'As', ['S1'], ['E1'], [protocol('extract')]),
    row('x2', 'As:extraction', 'As', ['S2'], ['E2'], [protocol('extract')]),
  ]
  const measurement = [
    row('m1', 'As:measurement', 'As', ['E1'], ['F1'], [protocol('GC-MS'), split]),
    row('m2', 'As:measurement', 'As', ['E1'], ['F2'], [protocol('GC-MS'), splitless]),
    row('m3', 'As:measurement', 'As', ['E2'], ['F3'], [protocol('GC-MS'), split]),
  ]
  const sigSplit = 'As:measurement#split'
  const sigSplitless = 'As:measurement#splitless'
  const measurementProcess: ProvenanceProcess = {
    key: 'As:measurement',
    name: 'measurement',
    datasetId: 'As',
    rowIds: ['m1', 'm2', 'm3'],
    signatures: [
      { id: sigSplit, rowIds: ['m1', 'm3'], annotations: [protocol('GC-MS'), split], distinguishing: [split] },
      { id: sigSplitless, rowIds: ['m2'], annotations: [protocol('GC-MS'), splitless], distinguishing: [splitless] },
    ],
    inputGroups: [
      group('As:measurement#in1', 'inputs', 'Inputs A', ['E1'], [sigSplit, sigSplitless]),
      group('As:measurement#in2', 'inputs', 'Inputs B', ['E2'], [sigSplit]),
    ],
    outputGroups: [
      group('As:measurement#out1', 'outputs', 'Outputs A', ['F1', 'F3'], [sigSplit]),
      group('As:measurement#out2', 'outputs', 'Outputs B', ['F2'], [sigSplitless]),
    ],
    groupEdges: [
      { id: 'As:measurement#e1', from: 'As:measurement#in1', to: 'As:measurement#out1', signatureId: sigSplit, rowIds: ['m1'] },
      { id: 'As:measurement#e2', from: 'As:measurement#in2', to: 'As:measurement#out1', signatureId: sigSplit, rowIds: ['m3'] },
      { id: 'As:measurement#e3', from: 'As:measurement#in1', to: 'As:measurement#out2', signatureId: sigSplitless, rowIds: ['m2'] },
    ],
  }
  return buildIndex({
    datasets: [
      { id: 'S', kind: 'study', identifier: 'S' },
      { id: 'As', kind: 'assay', identifier: 'As' },
    ],
    processes: [uniformProcess('S:sampling', 'S', sampling), uniformProcess('As:extraction', 'As', extraction), measurementProcess],
    rows: [...sampling, ...extraction, ...measurement],
    nodes: [
      node('A', 'source', [organism]),
      node('B', 'source'),
      node('S1', 'sample'),
      node('S2', 'sample'),
      node('E1', 'material'),
      node('E2', 'material'),
      node('F1', 'data'),
      node('F2', 'data'),
      node('F3', 'data'),
    ],
  })
}

describe('datasetGraph', () => {
  it('connects the study to the assay through the samples the assay consumes', () => {
    const graph = datasetGraph(fixture())
    expect(graph.nodes).toEqual([
      { id: 'S', kind: 'study', label: 'S' },
      { id: 'As', kind: 'assay', label: 'As' },
    ])
    expect(graph.edges).toEqual([{ id: 'S->As', from: 'S', to: 'As', sharedNodeIds: ['S1', 'S2'] }])
  })

  it('yields one edge for a node that 300 rows of one dataset produce and 300 rows of another consume', () => {
    const count = 300
    const producers = Array.from({ length: count }, (_, i) => row(`p${i}`, 'P:make', 'P', [], ['N'], []))
    const consumers = Array.from({ length: count }, (_, i) => row(`c${i}`, 'Q:use', 'Q', ['N'], [`o${i}`], []))
    const index = buildIndex({
      datasets: [
        { id: 'P', kind: 'study', identifier: 'P' },
        { id: 'Q', kind: 'assay', identifier: 'Q' },
      ],
      processes: [uniformProcess('P:make', 'P', producers), uniformProcess('Q:use', 'Q', consumers)],
      rows: [...producers, ...consumers],
      nodes: [node('N', 'sample')],
    })
    expect(datasetGraph(index).edges).toEqual([{ id: 'P->Q', from: 'P', to: 'Q', sharedNodeIds: ['N'] }])
    expect(processGraph(index, 'Q')?.edges).toEqual([{ id: 'P:make->Q:use', from: 'P:make', to: 'Q:use', sharedNodeIds: ['N'] }])
  })
})

describe('processGraph', () => {
  it('adds the external study process and links extraction to measurement inside the assay', () => {
    const graph = processGraph(fixture(), 'As')
    expect(graph?.dataset.identifier).toBe('As')
    expect(graph?.nodes).toEqual([
      { key: 'S:sampling', label: 'sampling', datasetId: 'S', datasetKind: 'study', datasetLabel: 'S', external: true, rowCount: 2 },
      { key: 'As:extraction', label: 'extraction', datasetId: 'As', datasetKind: 'assay', datasetLabel: 'As', external: false, rowCount: 2 },
      { key: 'As:measurement', label: 'measurement', datasetId: 'As', datasetKind: 'assay', datasetLabel: 'As', external: false, rowCount: 3 },
    ])
    expect(graph?.edges).toEqual([
      { id: 'S:sampling->As:extraction', from: 'S:sampling', to: 'As:extraction', sharedNodeIds: ['S1', 'S2'] },
      { id: 'As:extraction->As:measurement', from: 'As:extraction', to: 'As:measurement', sharedNodeIds: ['E1', 'E2'] },
    ])
  })

  it('leaves out edges and processes that do not touch the selected dataset', () => {
    const graph = processGraph(fixture(), 'S')
    expect(graph?.nodes.map((n) => [n.key, n.external])).toEqual([
      ['S:sampling', false],
      ['As:extraction', true],
    ])
    expect(graph?.edges.map((e) => e.id)).toEqual(['S:sampling->As:extraction'])
  })
})

describe('processGroups', () => {
  const graph = processGroups(fixture(), 'As:measurement')

  it('lists input groups before output groups with the kinds of their members', () => {
    expect(graph?.datasetKind).toBe('assay')
    expect(graph?.nodes).toEqual([
      { id: 'As:measurement#in1', side: 'inputs', label: 'Inputs A', kindCounts: { material: 1 } },
      { id: 'As:measurement#in2', side: 'inputs', label: 'Inputs B', kindCounts: { material: 1 } },
      { id: 'As:measurement#out1', side: 'outputs', label: 'Outputs A', kindCounts: { data: 2 } },
      { id: 'As:measurement#out2', side: 'outputs', label: 'Outputs B', kindCounts: { data: 1 } },
    ])
  })

  it('splits each edge into the distinguishing annotations and the rest', () => {
    expect(graph?.edges).toEqual([
      { id: 'As:measurement#e1', from: 'As:measurement#in1', to: 'As:measurement#out1', differing: [split], shared: [protocol('GC-MS')] },
      { id: 'As:measurement#e2', from: 'As:measurement#in2', to: 'As:measurement#out1', differing: [split], shared: [protocol('GC-MS')] },
      { id: 'As:measurement#e3', from: 'As:measurement#in1', to: 'As:measurement#out2', differing: [splitless], shared: [protocol('GC-MS')] },
    ])
  })
})

describe('processDetail', () => {
  it('emphasizes the group members and adds the output nodes of the rows that consume them', () => {
    const detail = processDetail(fixture(), 'As:measurement#in1')
    expect(detail?.process.key).toBe('As:measurement')
    expect(detail?.group.id).toBe('As:measurement#in1')
    expect(detail?.nodes.map((n) => [n.id, n.emphasized])).toEqual([
      ['E1', true],
      ['F1', false],
      ['F2', false],
    ])
    expect(detail?.edges.map((e) => [e.id, e.from, e.to])).toEqual([
      ['m1|E1|F1', 'E1', 'F1'],
      ['m2|E1|F2', 'E1', 'F2'],
    ])
  })

  it('puts the varying parameter in differing and the protocol in shared', () => {
    const edges = processDetail(fixture(), 'As:measurement#in1')?.edges
    expect(edges?.[0]).toMatchObject({
      processKey: 'As:measurement',
      processName: 'measurement',
      datasetKind: 'assay',
      differing: [split],
      shared: [protocol('GC-MS')],
    })
    expect(edges?.[1]).toMatchObject({ differing: [splitless], shared: [protocol('GC-MS')] })
  })

  it('adds the input nodes of the rows that produce the members of an output group', () => {
    const detail = processDetail(fixture(), 'As:measurement#out1')
    expect(detail?.nodes.map((n) => [n.id, n.emphasized])).toEqual([
      ['F1', true],
      ['F3', true],
      ['E1', false],
      ['E2', false],
    ])
    expect(detail?.edges.map((e) => e.id)).toEqual(['m1|E1|F1', 'm3|E2|F3'])
    // Both edges carry the same annotations, so nothing differs.
    expect(detail?.edges.map((e) => e.differing)).toEqual([[], []])
  })

  it('shares every annotation when the process has a single edge in the graph', () => {
    const edges = processDetail(fixture(), 'As:measurement#in2')?.edges
    expect(edges).toHaveLength(1)
    expect(edges?.[0].differing).toEqual([])
    expect(edges?.[0].shared).toEqual([protocol('GC-MS'), split])
  })

  it('connects only the rows whose input is in the group when two groups share an output', () => {
    const rows = [row('r1', 'D:p', 'D', ['a'], ['c'], []), row('r2', 'D:p', 'D', ['b'], ['c'], [])]
    const process: ProvenanceProcess = {
      ...uniformProcess('D:p', 'D', rows),
      inputGroups: [group('g-a', 'inputs', 'Inputs A', ['a'], []), group('g-b', 'inputs', 'Inputs B', ['b'], [])],
    }
    const index = buildIndex({
      datasets: [{ id: 'D', kind: 'run', identifier: 'D' }],
      processes: [process],
      rows,
      nodes: [node('a', 'data'), node('b', 'data'), node('c', 'data')],
    })
    const detail = processDetail(index, 'g-a')
    expect(detail?.nodes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(detail?.edges.map((e) => e.id)).toEqual(['r1|a|c'])
  })
})

describe('lineage', () => {
  it('follows S1 upstream to its source and downstream to the measurements, without sibling branches', () => {
    const graph = lineage(fixture(), 'S1')
    expect(graph?.nodeId).toBe('S1')
    expect(graph?.nodes.map((n) => n.id).sort()).toEqual(['A', 'E1', 'F1', 'F2', 'S1'])
    expect(graph?.nodes.filter((n) => n.emphasized).map((n) => n.id)).toEqual(['S1'])
    expect(graph?.nodes.find((n) => n.id === 'A')?.annotations).toEqual([organism])
    expect(graph?.edges.map((e) => e.id).sort()).toEqual(['m1|E1|F1', 'm2|E1|F2', 's1|A|S1', 'x1|S1|E1'])
  })

  it('keeps only ancestors of F1 and leaves out the branch of its sibling F2', () => {
    const graph = lineage(fixture(), 'F1')
    expect(graph?.nodes.map((n) => n.id).sort()).toEqual(['A', 'E1', 'F1', 'S1'])
    expect(graph?.edges.map((e) => e.id).sort()).toEqual(['m1|E1|F1', 's1|A|S1', 'x1|S1|E1'])
  })

  it('leaves out a second sample that the same source feeds through another row', () => {
    const rows = [row('t1', 'D:split', 'D', ['src'], ['a'], []), row('t2', 'D:split', 'D', ['src'], ['b'], [])]
    const index = buildIndex({
      datasets: [{ id: 'D', kind: 'study', identifier: 'D' }],
      processes: [uniformProcess('D:split', 'D', rows)],
      rows,
      nodes: [node('src', 'source'), node('a', 'sample'), node('b', 'sample')],
    })
    const graph = lineage(index, 'a')
    expect(graph?.nodes.map((n) => n.id).sort()).toEqual(['a', 'src'])
    expect(graph?.edges.map((e) => e.id)).toEqual(['t1|src|a'])
  })

  it('computes differing and shared per process within the lineage graph', () => {
    const edges = lineage(fixture(), 'S1')?.edges ?? []
    const byId = (id: string) => edges.find((e) => e.id === id)
    expect(byId('m1|E1|F1')).toMatchObject({ differing: [split], shared: [protocol('GC-MS')] })
    expect(byId('m2|E1|F2')).toMatchObject({ differing: [splitless], shared: [protocol('GC-MS')] })
    expect(byId('x1|S1|E1')).toMatchObject({ differing: [], shared: [protocol('extract')], processName: 'extraction' })
  })

  it('stops on a cycle', () => {
    const rows = [row('r1', 'D:loop', 'D', ['X'], ['Y'], []), row('r2', 'D:loop', 'D', ['Y'], ['X'], [])]
    const index = buildIndex({
      datasets: [{ id: 'D', kind: 'run', identifier: 'D' }],
      processes: [uniformProcess('D:loop', 'D', rows)],
      rows,
      nodes: [node('X', 'data'), node('Y', 'data')],
    })
    const graph = lineage(index, 'X')
    expect(graph?.nodes.map((n) => n.id).sort()).toEqual(['X', 'Y'])
    expect(graph?.edges.map((e) => e.id).sort()).toEqual(['r1|X|Y', 'r2|Y|X'])
  })
})

describe('a row whose input and output share a name', () => {
  // r1 and r2 read and write x and y. r3 sends x on to c.
  const rows = [
    row('r1', 'D:p', 'D', ['x'], ['x'], []),
    row('r2', 'D:p', 'D', ['y'], ['y'], []),
    row('r3', 'D:p', 'D', ['x'], ['c'], []),
  ]
  const index = buildIndex({
    datasets: [{ id: 'D', kind: 'run', identifier: 'D' }],
    processes: [{ ...uniformProcess('D:p', 'D', rows), inputGroups: [group('D:p#in', 'inputs', 'Inputs A', ['x', 'y'], [])] }],
    rows,
    nodes: [node('x', 'data'), node('y', 'data'), node('c', 'data')],
  })

  it('produces no loop edge in processDetail', () => {
    const detail = processDetail(index, 'D:p#in')
    expect(detail?.edges.map((e) => e.id)).toEqual(['r3|x|c'])
    expect(detail?.nodes.map((n) => n.id)).toEqual(['x', 'y', 'c'])
  })

  it('produces no loop edge in lineage', () => {
    expect(lineage(index, 'x')?.edges.map((e) => e.id)).toEqual(['r3|x|c'])
    expect(lineage(index, 'y')?.edges).toEqual([])
  })
})

describe('splitSharedAnnotations', () => {
  it('compares name, value, unit, accession and category', () => {
    const base = ann('parameter', 'temperature', '20')
    const withUnit = { ...base, unit: 'C' }
    const [first, second] = splitSharedAnnotations([[base, protocol('p')], [withUnit, protocol('p')]])
    expect(first).toEqual({ differing: [base], shared: [protocol('p')] })
    expect(second).toEqual({ differing: [withUnit], shared: [protocol('p')] })
  })
})

describe('unknown ids and purity', () => {
  it('return undefined for unknown ids', () => {
    const index = fixture()
    expect(processGraph(index, 'nope')).toBeUndefined()
    expect(processGroups(index, 'nope')).toBeUndefined()
    expect(processDetail(index, 'nope')).toBeUndefined()
    expect(lineage(index, 'nope')).toBeUndefined()
  })

  it('leave the index unchanged', () => {
    const index = fixture()
    const before = structuredClone(index)
    datasetGraph(index)
    processGraph(index, 'As')
    processGroups(index, 'As:measurement')
    processDetail(index, 'As:measurement#in1')
    lineage(index, 'S1')
    expect(index).toEqual(before)
  })
})
