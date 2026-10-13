import { ARC } from '@nfdi4plants/arctrl'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import crateJson from '../../../../../public/sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json?raw'
import { buildProvenanceIndex } from '../../../../arc/provenance/buildIndex'
import { ProvenanceExplorer } from './ProvenanceExplorer'

// Built once for all stories, like the parent of the explorer builds it once per ARC.
const sampleIndex = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))

// The explorer fills its parent, so the story gives it a box with a fixed size.
function SampleProvenanceExplorer({ width, height }: { width: number; height: number }) {
  return (
    <div style={{ width, height, margin: 16 }}>
      <ProvenanceExplorer index={sampleIndex} />
    </div>
  )
}

const meta = {
  title: 'Provenance/ProvenanceExplorer',
  component: SampleProvenanceExplorer,
  args: { width: 960, height: 560 },
  parameters: {
    docs: {
      description: {
        component:
          'Provenance of the bundled Talinum ARC, one detail view at a time. The card fills its parent box and the graph scrolls inside it when the box is smaller than the graph.',
      },
    },
  },
} satisfies Meta<typeof SampleProvenanceExplorer>

export default meta
type Story = StoryObj<typeof meta>

// The play functions click through the views the way a user does. Nodes are buttons named
// "<title>, ...", and the layout of each view finishes asynchronously, so every step waits for its button.
const LAYOUT_TIMEOUT = { timeout: 15000 }

async function clickNode(canvasElement: HTMLElement, title: string) {
  const node = await within(canvasElement).findByRole(
    'button',
    { name: (name) => name.startsWith(`${title},`) },
    LAYOUT_TIMEOUT,
  )
  await userEvent.click(node)
}

const toProcesses = (canvasElement: HTMLElement) => clickNode(canvasElement, 'GCqTOF_targets')

async function toGroups(canvasElement: HTMLElement) {
  await toProcesses(canvasElement)
  await clickNode(canvasElement, 'gas_chromatography')
}

async function toDetail(canvasElement: HTMLElement) {
  await toGroups(canvasElement)
  await clickNode(canvasElement, 'Inputs A')
}

// Waits for the layout of the last view, so the story rests on a finished drawing.
async function layoutDone(canvasElement: HTMLElement, graphLabel: RegExp) {
  await within(canvasElement).findByRole('group', { name: graphLabel }, LAYOUT_TIMEOUT)
}

export const Datasets: Story = {}

export const Processes: Story = {
  play: async ({ canvasElement }) => {
    await toProcesses(canvasElement)
    await layoutDone(canvasElement, /Process provenance graph/)
  },
}

export const Groups: Story = {
  play: async ({ canvasElement }) => {
    await toGroups(canvasElement)
    await layoutDone(canvasElement, /Input groups and output groups/)
  },
}

export const Detail: Story = {
  play: async ({ canvasElement }) => {
    await toDetail(canvasElement)
    await layoutDone(canvasElement, /Nodes connected to/)
  },
}

export const Lineage: Story = {
  play: async ({ canvasElement }) => {
    await toDetail(canvasElement)
    await clickNode(canvasElement, 'Std. Mix 5µM')
    await layoutDone(canvasElement, /Lineage graph/)
  },
}

export const SmallBox: Story = {
  args: { width: 480, height: 320 },
  play: Detail.play,
}

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await toDetail(canvasElement)
    const [more] = await within(canvasElement).findAllByRole('button', { name: /^Show \d+ more properties$/ }, LAYOUT_TIMEOUT)
    await userEvent.click(more)
  },
}
