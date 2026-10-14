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
          'One arena with the mage and a boss generated from a step of a planned Talinum run. Click the canvas first. Keys 1 to 9 pick the node boss of that step, S switches to another run seed and so another path. Q and W lower and raise the quality of the step in steps of 0.25: the slots stay, while the telegraph time, the safe zones, the weak points, the stagger bar and the damage multiplier change. F starts the final boss. P switches between the placeholder and the scribble art. The overlay lists every slot of the genome as the pause inspection shows it. Q, W, F and S also trigger mage abilities or moves, which this scene accepts.',
      },
    },
  },
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <SandboxStory scenes={scenes} />,
}
