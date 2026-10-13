import type { Meta, StoryObj } from '@storybook/react-vite'
import { withTalinumStory } from '../../../storybook/withTalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { CombinedDashboard } from './CombinedDashboard'

const SampleCombinedDashboard = withTalinumStory(CombinedDashboard)

const meta = {
  title: 'CombinedDashboard',
  component: SampleCombinedDashboard,
  args: { repository: talinumRepository, arcJson: talinumArcJson },
  parameters: {
    docs: {
      description: {
        component: 'The ARC header and two overlapping card rows occupy one third of the parent width. Together with Webview, the upper area occupies half of the parent height; Graphview fills the width below. Narrow card rows scroll horizontally. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof SampleCombinedDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
