import { ARC } from '@nfdi4plants/arctrl'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

// jsdom has no layout, so this stub reports the widths a test sets. The explorer observes two
// elements: a box with the width of the header content area and, inside it, the invisible full
// content of the header.
class StubResizeObserver {
  static all: StubResizeObserver[] = []
  targets: Element[] = []
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    StubResizeObserver.all.push(this)
  }
  observe(target: Element) {
    this.targets.push(target)
  }
  unobserve() {}
  disconnect() {
    this.targets = []
  }
}

// Reports the width of the header content area and the natural width of its full content.
function setHeaderWidths(available: number, natural: number) {
  const explorer = screen.getByRole('region', { name: 'Provenance explorer' })
  const observer = StubResizeObserver.all.find(
    ({ targets: [box, full] }) => box && full && explorer.contains(box) && box.contains(full),
  )
  if (!observer) throw new Error('The explorer observes no header box.')
  const [box, full] = observer.targets
  const entries = [
    { target: box, contentRect: { width: available } },
    { target: full, contentRect: { width: natural } },
  ] as ResizeObserverEntry[]
  act(() => observer.callback(entries, observer as unknown as ResizeObserver))
}

const queryName = (name: string) => screen.queryByText(name)
const moreButton = () => screen.queryByRole('button', { name: /^Show \d+ more levels?$/ })

describe('ProvenanceExplorer header', () => {
  beforeEach(() => {
    StubResizeObserver.all = []
    vi.stubGlobal('ResizeObserver', StubResizeObserver)
    // The header applies a measurement in the next animation frame, which the tests run at once.
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
  })

  async function openLineage() {
    const user = await openGroupsOfGasChromatography()
    await clickNode(user, 'Inputs A')
    await clickNode(user, 'Std. Mix 5µM')
    return user
  }

  it('shows all crumbs and the query name when the full header fits', async () => {
    await openLineage()

    setHeaderWidths(900, 640)

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography', 'Inputs A', 'Std. Mix 5µM'])
    expect(queryName('lineage(index, nodeId)')).toBeInTheDocument()
    expect(moreButton()).not.toBeInTheDocument()
    expect(crumbs().getByText('Std. Mix 5µM')).not.toHaveAttribute('title')
  })

  it('keeps the full header when it fits to the pixel and switches when it is a fraction wider', async () => {
    await openLineage()

    setHeaderWidths(640.4, 640)
    expect(queryName('lineage(index, nodeId)')).toBeInTheDocument()

    setHeaderWidths(640, 640.2)
    expect(queryName('lineage(index, nodeId)')).not.toBeInTheDocument()
  })

  it('shows the first crumb, a menu button and the last two crumbs when the full header does not fit', async () => {
    await openLineage()

    setHeaderWidths(330, 640)

    expect(crumbTexts()).toEqual(['Datasets', '…', 'Inputs A', 'Std. Mix 5µM'])
    expect(queryName('lineage(index, nodeId)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show 2 more levels' })).toBeInTheDocument()
    expect(crumbs().getByText('Std. Mix 5µM')).toHaveAttribute('aria-current', 'page')
    expect(crumbs().getByText('Std. Mix 5µM')).toHaveAttribute('title', 'Std. Mix 5µM')
    // The crumb before the current one can be cut first, so it carries its full text too.
    expect(crumbs().getByRole('button', { name: 'Inputs A' })).toHaveAttribute('title', 'Inputs A')
  })

  it('lists the hidden crumbs in the menu and navigates to the chosen one', async () => {
    const user = await openLineage()
    setHeaderWidths(330, 640)

    await user.click(screen.getByRole('button', { name: 'Show 2 more levels' }))

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['GCqTOF_targets', 'gas_chromatography'])

    await user.click(screen.getByRole('menuitem', { name: 'gas_chromatography' }))

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography'])
    expect(await nodeLabels()).toHaveLength(6)
    expect(screen.getByRole('region', { name: /^Input groups and output groups/ })).toHaveFocus()
  })

  it('brings the full header back when the box grows', async () => {
    await openLineage()
    setHeaderWidths(330, 640)

    setHeaderWidths(900, 640)

    expect(crumbTexts()).toHaveLength(5)
    expect(queryName('lineage(index, nodeId)')).toBeInTheDocument()
    expect(moreButton()).not.toBeInTheDocument()
  })

  it('brings the full header back when the path gets shorter', async () => {
    const user = await openLineage()
    setHeaderWidths(330, 640)
    await user.click(screen.getByRole('button', { name: 'Show 2 more levels' }))
    await user.click(screen.getByRole('menuitem', { name: 'GCqTOF_targets' }))
    expect(queryName('processGraph(index, datasetId)')).not.toBeInTheDocument()

    setHeaderWidths(330, 250)

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets'])
    expect(queryName('processGraph(index, datasetId)')).toBeInTheDocument()
  })

  it('collapses nothing with three crumbs and still hides the query name', async () => {
    await openGroupsOfGasChromatography()

    setHeaderWidths(200, 480)

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography'])
    expect(moreButton()).not.toBeInTheDocument()
    expect(queryName('processGroups(index, processKey)')).not.toBeInTheDocument()
    expect(crumbs().getByText('gas_chromatography')).toHaveAttribute('title', 'gas_chromatography')
  })

  it('collapses the one crumb in the middle of four', async () => {
    const user = await openGroupsOfGasChromatography()
    await clickNode(user, 'Inputs A')

    setHeaderWidths(300, 560)

    expect(crumbTexts()).toEqual(['Datasets', '…', 'gas_chromatography', 'Inputs A'])
    expect(screen.getByRole('button', { name: 'Show 1 more level' })).toBeInTheDocument()
  })
})
