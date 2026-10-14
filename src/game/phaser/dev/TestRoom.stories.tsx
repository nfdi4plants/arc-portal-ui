import type { Meta, StoryObj } from '@storybook/react-vite'
import { SandboxStory } from './SandboxStory'
import { TestRoomScene } from './TestRoomScene'

const meta = {
  title: 'Game/Dev/TestRoom',
  component: SandboxStory,
  args: { scenes: [TestRoomScene] },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Movement and combat sandbox. Click the canvas, then use WASD, Space, Shift and the mouse buttons. F3 shows the debug panel, keys 1 to 4 toggle double jump, air dash, wall jump and hat glide.',
      },
    },
  },
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SandboxStory scenes={[TestRoomScene]} />,
}
