import type { Meta, StoryObj } from '@storybook/react-vite'
import { BossSandboxScene } from './BossSandboxScene'
import { SandboxStory } from './SandboxStory'

// A stable array keeps the sandbox from rebooting on every render.
const scenes = [BossSandboxScene]

const meta = {
  title: 'Game/Dev/BossSandbox',
  component: SandboxStory,
  args: { scenes },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One arena with the mage and a boss. Click the canvas first. Keys 1 to 4 pick the archetype (source, sample, material, data). Q and W lower and raise the annotation quality in steps of 0.25, which changes the telegraph time, the safe zones, the weak points, the stagger window and the tells. F starts the final boss for the Talinum ARC. P switches between the placeholder and the scribble art. Q, W and F also trigger the mage abilities and W moves up, which this scene accepts.',
      },
    },
  },
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SandboxStory scenes={scenes} />,
}
