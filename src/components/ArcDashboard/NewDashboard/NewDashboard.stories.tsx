import type { Meta, StoryObj } from '@storybook/react-vite'
import { withTalinumStory } from '../../../storybook/withTalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { NewDashboard } from './NewDashboard'

const SampleNewDashboard = withTalinumStory(NewDashboard)

const meta = {
  title: 'NewDashboard',
  component: SampleNewDashboard,
  args: {
    repository: talinumRepository,
    arcJson: talinumArcJson,
  },
  parameters: {
    docs: {
      description: {
        component: 'Alternate investigation dashboard with a circular ARC header and eight equally sized, compact dashlets: Description, Contacts, Organizations, Publications, Assays, Studies, Webview, and Graphview. Hover for a short description; click to expand over the dashboard. Click outside, press Escape, or use Smaller to restore the dashlet. Overview is omitted. The layout stacks on smaller screens. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof SampleNewDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = {
  name: 'Without DataHub Access',
  args: { dataHubData: undefined },
}

export const Public: Story = {
  name: 'Public DataHub Access',
  args: { dataHubData: publicTalinumDataHubData },
}

export const Private: Story = {
  name: 'Private DataHub Access',
  args: { dataHubData: privateTalinumDataHubData },
}
