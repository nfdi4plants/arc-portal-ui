import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../src/arc/provenance/buildIndex'
import { datasetGraph } from '../../src/arc/provenance/queries'
import {
  selectDatasetGraph,
  selectLineage,
  selectProcessDetail,
  selectProcessGraph,
  selectProcessGroups,
} from '../../src/arc/selectors/provenance'
import { crateJson } from '../helpers/sampleCrate'

let arc: ARC

beforeAll(() => {
  arc = ARC.fromROCrateJsonString(crateJson)
})

const datasetId = 'assays/GCqTOF_targets/'
const processKey = `${datasetId}::gas_chromatography`
const groupId = `${processKey}#in0`
const nodeId = 'Std. Mix 5µM'

describe('provenance selectors', () => {
  it('selectDatasetGraph lists the 11 datasets', () => {
    const graph = selectDatasetGraph(arc)

    expect(graph.nodes).toHaveLength(11)
    expect(graph.nodes.map((node) => node.label)).toContain('GCqTOF_targets')
  })

  it('selectProcessGraph lists the processes of a dataset', () => {
    const graph = selectProcessGraph(arc, datasetId)

    expect(graph?.dataset.identifier).toBe('GCqTOF_targets')
    expect(graph?.nodes.map((node) => node.label)).toContain('gas_chromatography')
  })

  it('selectProcessGroups lists the 2 input and 4 output groups of a process', () => {
    const graph = selectProcessGroups(arc, processKey)

    expect(graph?.process.name).toBe('gas_chromatography')
    expect(graph?.nodes.filter((node) => node.side === 'inputs')).toHaveLength(2)
    expect(graph?.nodes.filter((node) => node.side === 'outputs')).toHaveLength(4)
  })

  it('selectProcessDetail lists the nodes of a group', () => {
    const graph = selectProcessDetail(arc, groupId)

    expect(graph?.group.label).toBe('Inputs A')
    expect(graph?.nodes).toContainEqual(expect.objectContaining({ id: nodeId, emphasized: true }))
  })

  it('selectLineage centers the lineage on the given node', () => {
    const graph = selectLineage(arc, nodeId)

    expect(graph?.nodeId).toBe(nodeId)
    expect(graph?.nodes).toContainEqual(expect.objectContaining({ id: nodeId, emphasized: true }))
    expect(graph?.edges.length).toBeGreaterThan(0)
  })

  it.each([
    ['selectProcessGraph', selectProcessGraph],
    ['selectProcessGroups', selectProcessGroups],
    ['selectProcessDetail', selectProcessDetail],
    ['selectLineage', selectLineage],
  ])('%s returns undefined for an unknown id', (_name, select) => {
    expect(select(arc, 'does-not-exist')).toBeUndefined()
  })

  it('buildProvenanceIndex builds the index the selectors read', () => {
    const index = buildProvenanceIndex(arc)

    expect(index.datasets).toHaveLength(11)
    expect(datasetGraph(index)).toEqual(selectDatasetGraph(arc))
  })
})
