import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArtGalleryScene } from './ArtGalleryScene'
import { SandboxStory } from './SandboxStory'

const scenes = [ArtGalleryScene]

const meta = {
  title: 'Game/Dev/ArtGallery',
  component: SandboxStory,
} satisfies Meta<typeof SandboxStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { scenes },
}
