import type { Meta, StoryObj } from '@storybook/react-vite'
import { MobSandboxScene } from './MobSandboxScene'
import { SandboxStory } from './SandboxStory'

// A stable array, so the sandbox boots once instead of on every render.
const scenes = [MobSandboxScene]

const meta = {
  title: 'Game/Dev/MobSandbox',
  component: SandboxStory,
  args: { scenes },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Every monster of a planned Talinum run on one long floor, with the player from the test room. Click the canvas, then use WASD, Space, Shift and the mouse buttons. Monsters far from the camera sleep. The panel shows the fps and the number of awake monsters. N spawns a random monster next to the player.',
      },
    },
  },
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
