import { ARC } from '@nfdi4plants/arctrl'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ProvenanceIndex } from '../../src/arc/provenance/types'
import { buildProvenanceIndex } from '../../src/arc/provenance/buildIndex'
import { ProvenanceExplorer } from '../../src/components/ArcDashboard/Provenance/ProvenanceExplorer'
import { crateJson } from '../helpers/sampleCrate'

let sampleIndex: ProvenanceIndex

beforeAll(() => {
  sampleIndex = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
})

function renderExplorer() {
  const user = userEvent.setup()
  render(<ProvenanceExplorer index={sampleIndex} />)
  return user
}

// The real canvas lays out asynchronously, so a view is ready once its graph group exists.
const canvas = async () => within(await screen.findByRole('group'))
const crumbs = () => within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
const crumbTexts = () => crumbs().getAllByRole('listitem').map((item) => item.textContent)
const legend = () => within(screen.getByRole('list', { name: 'Legend' }))

// Nodes are buttons named "<title>, ... select to ...". Edge toggles are buttons too and are not nodes.
async function nodeLabels() {
  const view = await canvas()
  return view.getAllByRole('button', { name: /select/ }).map((button) => button.getAttribute('aria-label'))
}

async function clickNode(user: ReturnType<typeof userEvent.setup>, title: string) {
  const view = await canvas()
  await user.click(view.getByRole('button', { name: (name) => name.startsWith(`${title},`) }))
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
      'Inputs A, 3 samples, select to list its nodes',
      'Inputs B, 6 samples, select to list its nodes',
      'Outputs A, 4 samples, select to list its nodes',
      'Outputs B, 4 samples, select to list its nodes',
      'Outputs C, 6 samples, select to list its nodes',
      'Outputs D, 6 samples, select to list its nodes',
    ])
  })

  it('opens the detail view of a clicked group', async () => {
    const user = await openGroupsOfGasChromatography()

    await clickNode(user, 'Inputs A')

    expect(crumbTexts()).toEqual(['Datasets', 'GCqTOF_targets', 'gas_chromatography', 'Inputs A'])
    expect(screen.getByText('processDetail(index, groupId)')).toBeInTheDocument()
    expect(screen.getByText('Select a node to see its lineage.')).toBeInTheDocument()
    expect(await nodeLabels()).toContain('Std. Mix 5µM, sample, member of Inputs A, select to show its lineage')
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
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
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
})
