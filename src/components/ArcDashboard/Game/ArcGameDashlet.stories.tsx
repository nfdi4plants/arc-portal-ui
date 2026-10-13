import { ARC } from '@nfdi4plants/arctrl'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import { talinumArcJson } from '../../../storybook/fixtures/talinumArc'
import { ArcGameDashlet } from './ArcGameDashlet'

const sampleArc = ARC.fromROCrateJsonString(talinumArcJson)
const sampleIndex = buildProvenanceIndex(sampleArc)
const sampleTitle = sampleArc.Title ?? 'Facultative CAM in Talinum'

function SampleArcGameDashlet({ maxWidth, height, title }: { maxWidth: number; height: number; title?: string }) {
  return (
    <div style={{ padding: 16 }}>
      <ArcGameDashlet index={sampleIndex} arcTitle={sampleTitle} maxWidth={maxWidth} height={height} title={title} />
    </div>
  )
}

const meta = {
  title: 'Game/ArcGameDashlet',
  component: SampleArcGameDashlet,
  args: { maxWidth: 960, height: 560 },
  parameters: {
    docs: {
      description: {
        component:
          'The ARC Mage inside a Dashlet frame. The start screen previews one path through the provenance of the bundled Talinum ARC. Start run boots the game, Settings rebinds the controls.',
      },
    },
  },
} satisfies Meta<typeof SampleArcGameDashlet>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SmallBox: Story = { args: { maxWidth: 480, height: 320 } }

// The box fills the preview, so the device chosen in the viewport toolbar sets the size of the dashlet.
function ViewportBox() {
  return (
    <div style={{ boxSizing: 'border-box', width: '100vw', height: '100vh', padding: 8 }}>
      <ArcGameDashlet index={sampleIndex} arcTitle={sampleTitle} height="100%" />
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
          'Pick a device in the viewport toolbar, or rotate it. Wide boxes put the path preview and the mage side by side. Narrow and portrait boxes stack them from top to bottom. On a touch-only device the start screen asks for a keyboard and a mouse.',
      },
    },
  },
}
