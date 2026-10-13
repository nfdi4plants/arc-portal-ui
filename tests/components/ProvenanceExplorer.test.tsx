import { ARC } from '@nfdi4plants/arctrl'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import type {
  ProvenanceDataset,
  ProvenanceIndex,
  ProvenanceNode,
  ProvenanceProcess,
  ProvenanceRow,
} from '../../src/arc/provenance/types'
import { buildProvenanceIndex } from '../../src/arc/provenance/buildIndex'
import { ProvenanceExplorer } from '../../src/components/ArcDashboard/Provenance/ProvenanceExplorer'
import { crateJson } from '../helpers/sampleCrate'

let sampleIndex: ProvenanceIndex

beforeAll(() => {
  sampleIndex = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
})

function renderExplorer(index: ProvenanceIndex = sampleIndex) {
  const user = userEvent.setup()
  render(<ProvenanceExplorer index={index} />)
  return user
}

// The canvas region is there while the layout runs, so a view is ready once the region holds a
// node. Every node of the explorer is a button.
async function canvas() {
  const region = await screen.findByRole('region', { name: (name) => name !== 'Provenance explorer' })
  await within(region).findAllByRole('button')
  return within(region)
}
const noCanvas = () => screen.queryByRole('region', { name: (name) => name !== 'Provenance explorer' })
const crumbs = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
const crumbTexts = () =>
  crumbs()
    .getAllByRole('listitem')
    .map((item) => item.querySelector('button, [aria-current]')?.textContent)
const legend = () => within(screen.getByRole('list', { name: 'Legend' }))

// Nodes are buttons named "<title>, ... select to ..., <tooltip>". Edge toggles are buttons too and are not nodes.
async function nodeLabels() {
  const view = await canvas()
  return view.getAllByRole('button', { name: /select/ }).map((button) => button.getAttribute('aria-label'))
}

async function clickNode(user: ReturnType<typeof userEvent.setup>, title: string) {
  const view = await canvas()
  await user.click(view.getByRole('button', { name: (name) => name.startsWith(`${title},`) }))
}

// A chain of samples n0 -> n1 -> ... with `length` samples. The first row is the process "first"
// with one input group and one output group. The other rows are the process "rest" without groups,
// so the group views stay small and only the lineage of n0 grows large.
function chainIndex(length: number): ProvenanceIndex {
  const dataset: ProvenanceDataset = { id: 'assays/chain/', kind: 'assay', identifier: 'chain' }
  const nodeIds = Array.from({ length }, (_, i) => `n${i}`)
  const nodes: ProvenanceNode[] = nodeIds.map((id) => ({
    id,
    kind: 'sample',
    annotations: [],
    datasetIds: [dataset.id],
    processKeys: [],
  }))
  const firstKey = `${dataset.id}::first`
  const restKey = `${dataset.id}::rest`
  const rows: ProvenanceRow[] = nodeIds.slice(1).map((outputId, i) => ({
    id: `row${i}`,
    name: `row${i}`,
    processKey: i === 0 ? firstKey : restKey,
    datasetId: dataset.id,
    inputs: [nodeIds[i]],
    outputs: [outputId],
    annotations: [],
  }))

  const signatureId = `${firstKey}#sig`
  const inputGroup = {
    id: `${firstKey}#in0`,
    side: 'inputs' as const,
    label: 'Inputs A',
    nodeIds: ['n0'],
    signatureIds: [signatureId],
  }
  const outputGroup = {
    id: `${firstKey}#out0`,
    side: 'outputs' as const,
    label: 'Outputs A',
    nodeIds: ['n1'],
    signatureIds: [signatureId],
  }
  const first: ProvenanceProcess = {
    key: firstKey,
    name: 'first',
    datasetId: dataset.id,
    rowIds: ['row0'],
    signatures: [{ id: signatureId, rowIds: ['row0'], annotations: [], distinguishing: [] }],
    inputGroups: [inputGroup],
    outputGroups: [outputGroup],
    groupEdges: [{ id: `${firstKey}#e0`, from: inputGroup.id, to: outputGroup.id, signatureId, rowIds: ['row0'] }],
  }
  const rest: ProvenanceProcess = {
    key: restKey,
    name: 'rest',
    datasetId: dataset.id,
    rowIds: rows.slice(1).map((row) => row.id),
    signatures: [],
    inputGroups: [],
    outputGroups: [],
    groupEdges: [],
  }

  return {
    datasets: [dataset],
    processes: [first, rest],
    rows,
    nodes,
    datasetById: new Map([[dataset.id, dataset]]),
    processByKey: new Map([first, rest].map((process) => [process.key, process])),
    rowById: new Map(rows.map((row) => [row.id, row])),
    nodeById: new Map(nodes.map((node) => [node.id, node])),
    groupById: new Map([inputGroup, outputGroup].map((group) => [group.id, group])),
    producedBy: new Map(rows.map((row) => [row.outputs[0], [row.id]])),
    consumedBy: new Map(rows.map((row) => [row.inputs[0], [row.id]])),
  }
}

async function openGroupsOfGasChromatography() {
  const user = renderExplorer()
  await clickNode(user, 'GCqTOF_targets')
  await clickNode(user, 'gas_chromatography')
  return user
}

describe('ProvenanceExplorer', () => {
  it('starts with the 11 datasets and the single crumb "Datasets"', async () => {
    renderExplorer()

    expect(await nodeLabels()).toHaveLength(11)
    expect(crumbTexts()).toEqual(['Datasets'])
    expect(crumbs().getByText('Datasets')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('datasetGraph(index)')).toBeInTheDocument()
    expect(legend().getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Study', 'Assay', 'Run'])
  })

  it('opens the processes of a clicked dataset', async () => {
    const user = renderExplorer()

    await clickNode(user, 'GCqTOF_targets')

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets'])
    expect(screen.getByText('processGraph(index, datasetId)')).toBeInTheDocument()
    expect((await nodeLabels()).map((label) => label?.split(',')[0])).toEqual([
      'plant_material',
      'metabolite_extraction',
      'gas_chromatography',
      'mass_spec',
      'mh-quant-results',
    ])
    expect((await canvas()).getAllByText('20').length).toBeGreaterThan(0)
    expect(legend().getByText('Other dataset')).toBeInTheDocument()
  })

  it('opens the 2 input and 4 output groups of a clicked own process', async () => {
    await openGroupsOfGasChromatography()

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography'])
    expect(await nodeLabels()).toEqual([
      expect.stringContaining('Inputs A, 3 samples, select to list its nodes'),
      expect.stringContaining('Inputs B, 6 samples, select to list its nodes'),
      expect.stringContaining('Outputs A, 4 samples, select to list its nodes'),
      expect.stringContaining('Outputs B, 4 samples, select to list its nodes'),
      expect.stringContaining('Outputs C, 6 samples, select to list its nodes'),
      expect.stringContaining('Outputs D, 6 samples, select to list its nodes'),
    ])
  })

  it('opens the detail view of a clicked group', async () => {
    const user = await openGroupsOfGasChromatography()

    await clickNode(user, 'Inputs A')

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography', 'Inputs A'])
    expect(screen.getByText('processDetail(index, groupId)')).toBeInTheDocument()
    expect(screen.getByText('Select a node to see its lineage.')).toBeInTheDocument()
    expect(await nodeLabels()).toContainEqual(
      expect.stringContaining('Std. Mix 5µM, sample, member of Inputs A, select to show its lineage'),
    )
  })

  it('opens the lineage of a clicked node and keeps navigating inside it', async () => {
    const user = await openGroupsOfGasChromatography()
    await clickNode(user, 'Inputs A')

    await clickNode(user, 'Std. Mix 5µM')

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography', 'Inputs A', 'Std. Mix 5µM'])
    expect(screen.getByText('lineage(index, nodeId)')).toBeInTheDocument()
    expect(screen.queryByText('Select a node to see its lineage.')).not.toBeInTheDocument()
    expect(legend().getByText('Protocol and other')).toBeInTheDocument()

    await clickNode(user, '150112_03')

    expect(crumbTexts().slice(3)).toEqual(['Inputs A', '150112_03'])
  })

  it('returns to the groups from the process crumb and drops the deeper crumbs', async () => {
    const user = await openGroupsOfGasChromatography()
    await clickNode(user, 'Inputs A')
    await clickNode(user, 'Std. Mix 5µM')

    await user.click(crumbs().getByRole('button', { name: 'gas_chromatography' }))

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography'])
    expect(screen.getByText('processGroups(index, processKey)')).toBeInTheDocument()
    expect(await nodeLabels()).toHaveLength(6)
  })

  it('switches to the dataset of an external process when it is clicked', async () => {
    const user = renderExplorer()
    await clickNode(user, 'GCqTOF_targets')

    await clickNode(user, 'plant_material')

    expect(crumbTexts()).toEqual(['Datasets', 'TalinumSamples-STRI', 'plant_material'])
    expect((await nodeLabels()).map((label) => label?.split(',')[0])).toEqual([
      'Inputs A',
      'Inputs B',
      'Outputs A',
      'Outputs B',
    ])

    await user.click(crumbs().getByRole('button', { name: 'TalinumSamples-STRI' }))

    expect(crumbTexts()).toEqual(['Datasets', 'TalinumSamples-STRI'])
    expect((await nodeLabels()).map((label) => label?.split(',')[0])).toContain('rna_extraction')
  })

  it('tells that a dataset without processes has none and keeps the footer', async () => {
    const user = renderExplorer()

    await clickNode(user, 'deseq2')

    expect(screen.getByText('This dataset has no annotated processes.')).toBeInTheDocument()
    expect(legend().getByText('Run')).toBeInTheDocument()
    expect(noCanvas()).not.toBeInTheDocument()
  })

  it('tells that a process whose rows have no inputs and outputs has none', async () => {
    const arc = ARC.fromROCrateJsonString(crateJson)
    const table = arc.Assays.find((assay) => assay.Identifier === 'GCqTOF_targets')!.Tables.find((t) => t.Name === 'mass_spec')!
    table.RemoveColumns([table.Headers.findIndex((h) => h.isInput), table.Headers.findIndex((h) => h.isOutput)])
    const user = renderExplorer(buildProvenanceIndex(arc))

    await clickNode(user, 'GCqTOF_targets')
    await clickNode(user, 'mass_spec')

    expect(screen.getByText('This process has no inputs or outputs.')).toBeInTheDocument()
    expect(noCanvas()).not.toBeInTheDocument()
  })

  it('keeps the focus in the card when a view without a graph comes and goes', async () => {
    const user = renderExplorer()

    await clickNode(user, 'deseq2')
    expect(screen.getByText('This dataset has no annotated processes.')).toHaveFocus()

    await user.click(crumbs().getByRole('button', { name: 'Datasets' }))
    await canvas()
    expect(screen.getByRole('region', { name: 'Dataset provenance graph' })).toHaveFocus()
  })

  it('returns to the datasets when the parent passes the index of another ARC', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ProvenanceExplorer index={sampleIndex} />)
    await clickNode(user, 'GCqTOF_targets')
    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets'])

    rerender(<ProvenanceExplorer index={buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))} />)

    expect(crumbTexts()).toEqual(['Datasets'])
    expect(screen.getByText('datasetGraph(index)')).toBeInTheDocument()
    expect(await nodeLabels()).toHaveLength(11)
  })

  it('tells that an ARC without datasets has none and keeps the footer', () => {
    renderExplorer(buildProvenanceIndex(new ARC('empty-arc')))

    expect(screen.getByText('This ARC has no datasets.')).toBeInTheDocument()
    expect(legend().getByText('Study')).toBeInTheDocument()
    expect(noCanvas()).not.toBeInTheDocument()
  })

  it('shows the 80 nodes nearest to the selected one of a larger lineage and says so', async () => {
    const user = renderExplorer(chainIndex(100))
    await clickNode(user, 'chain')
    await clickNode(user, 'first')
    await clickNode(user, 'Inputs A')

    await clickNode(user, 'n0')

    expect(await screen.findByText('Showing 80 of 100 nodes.')).toBeInTheDocument()
    expect(await nodeLabels()).toHaveLength(80)
  })
})
