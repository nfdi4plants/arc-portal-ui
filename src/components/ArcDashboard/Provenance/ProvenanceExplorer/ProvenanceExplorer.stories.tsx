import { ARC } from '@nfdi4plants/arctrl'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'
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

// Waits for the layout of the last view, so the story rests on a finished drawing. The region
// shows up before the layout ends, its node buttons only after.
async function layoutDone(canvasElement: HTMLElement, graphLabel: RegExp) {
  const region = await within(canvasElement).findByRole('region', { name: graphLabel }, LAYOUT_TIMEOUT)
  await within(region).findAllByRole('button', {}, LAYOUT_TIMEOUT)
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

// The box fills the preview, so the device chosen in the viewport toolbar sets the size of the explorer.
function ViewportBox() {
  return (
    <div style={{ boxSizing: 'border-box', width: '100vw', height: '100vh', padding: 8 }}>
      <ProvenanceExplorer index={sampleIndex} />
    </div>
  )
}

export const Viewport: Story = {
  render: () => <ViewportBox />,
  parameters: {
    viewport: { options: INITIAL_VIEWPORTS },
    docs: {
      description: {
        story:
          'Opens the groups of gas_chromatography, whose edges carry "+N" pills. Pick a device in the viewport toolbar, or rotate it, to try the behaviors: in a wide box "+N" wraps the hidden pills below the edge, in a narrow box it opens a list, and in a box taller than wide the graph flows top to bottom with one chip per edge. The header collapses its middle crumbs when the path does not fit.',
      },
    },
  },
  play: async ({ canvasElement }) => {
    await toGroups(canvasElement)
    await layoutDone(canvasElement, /Input groups and output groups/)
  },
}

export const Expanded: Story = {
  play: async ({ canvasElement }) => {
    await toDetail(canvasElement)
    const [more] = await within(canvasElement).findAllByRole('button', { name: /^Show \d+ more properties of / }, LAYOUT_TIMEOUT)
    await userEvent.click(more)
  },
}
