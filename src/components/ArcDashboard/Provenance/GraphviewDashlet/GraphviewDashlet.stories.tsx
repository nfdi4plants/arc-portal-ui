import { ARC } from '@nfdi4plants/arctrl'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { userEvent, within } from 'storybook/test'
import { buildProvenanceIndex } from '../../../../arc/provenance/buildIndex'
import { talinumArcJson } from '../../../../storybook/fixtures/talinumArc'
import { GraphviewDashlet } from './GraphviewDashlet'

const sampleIndex = buildProvenanceIndex(ARC.fromROCrateJsonString(talinumArcJson))

function SampleGraphviewDashlet({ maxWidth, height, title }: { maxWidth: number; height: number; title?: string }) {
  return (
    <div style={{ padding: 16 }}>
      <GraphviewDashlet index={sampleIndex} maxWidth={maxWidth} height={height} title={title} />
    </div>
  )
}

const meta = {
  title: 'Provenance/GraphviewDashlet',
  component: SampleGraphviewDashlet,
  args: { maxWidth: 960, height: 560 },
  parameters: {
    docs: { description: { component: 'A single Dashlet frame containing the provenance view, with its breadcrumbs, graph viewport, and legend. Title, maximum width, and height are configurable.' } },
  },
} satisfies Meta<typeof SampleGraphviewDashlet>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = {}

export const WithTitle: Story = { args: { title: 'Provenance' } }

export const SmallBox: Story = {
  args: { maxWidth: 480, height: 320 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const dataset = await canvas.findByRole('button', { name: (name) => name.startsWith('GCqTOF_targets,') }, { timeout: 15000 })
    await userEvent.click(dataset)
    await canvas.findByRole('region', { name: 'Process provenance graph' }, { timeout: 15000 })
  },
}
