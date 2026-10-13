import type { Meta, StoryObj } from '@storybook/react-vite'
import { CombatSandboxScene } from './CombatSandboxScene'
import { SandboxStory } from './SandboxStory'

// A stable array, so the sandbox boots once instead of on every render.
const scenes = [CombatSandboxScene]

const meta = {
  title: 'Game/Dev/CombatSandbox',
  component: SandboxStory,
  args: { scenes },
  parameters: {
    docs: {
      description: {
        component:
          'The combat core with three dummies and no player. The attacker swings a melee hitbox every second and fires a projectile every 1.5 s at the target dummy. The right dummy raises a reflect hitbox every 2 s and sends some shots back. Debug outlines are on.',
      },
    },
  },
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
