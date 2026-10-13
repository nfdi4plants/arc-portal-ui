import type { Meta, StoryObj } from '@storybook/react-vite'
import { LoadoutSandboxScene } from './LoadoutSandboxScene'
import { SandboxStory } from './SandboxStory'

// A stable array, so the sandbox boots once instead of on every render.
const scenes = [LoadoutSandboxScene]

const meta = {
  title: 'Game/Dev/LoadoutSandbox',
  component: SandboxStory,
  args: { scenes },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The player with every weapon, mechanic and legendary. Click the canvas, then play with WASD, Space, Shift, the mouse buttons and Q, E, R, F. The panel on the right toggles any card. Training dummies respawn after a knockout, and the turret fires slow projectiles that the reflect effects can send back.',
      },
    },
  },
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
