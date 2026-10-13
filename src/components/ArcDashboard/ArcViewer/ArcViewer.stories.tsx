import type { Meta, StoryObj } from '@storybook/react-vite'
import '../../../index.css'
import ArcViewer from './ArcViewer'

const meta = {
  title: 'Dashboard/ArcWebView',
  component: ArcViewer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'ARC web viewer using the bundled Talinum ARC, shared with the Investigation story.',
      },
    },
  },
} satisfies Meta<typeof ArcViewer>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = {}
