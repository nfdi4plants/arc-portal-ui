import type { Meta, StoryObj } from '@storybook/react-vite'
import { talinumArcJson } from '../../../storybook/fixtures/talinumArc'
import ArcViewer from './ArcViewer'

const meta = {
  title: 'ARCDetails/ArcWebView',
  component: ArcViewer,
  args: { jsonString: talinumArcJson },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'ARC web viewer using the bundled Talinum ARC, shared with the ARCDetails and InvestigationDetails stories.',
      },
    },
  },
} satisfies Meta<typeof ArcViewer>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = {}
