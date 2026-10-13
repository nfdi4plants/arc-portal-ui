import type { Meta, StoryObj } from '@storybook/react-vite'
import { withTalinumStory } from '../../../storybook/withTalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { SplitDashboard } from './SplitDashboard'

const SampleSplitDashboard = withTalinumStory(SplitDashboard)

const meta = {
  title: 'SplitDashboard',
  component: SampleSplitDashboard,
  args: { repository: talinumRepository, arcJson: talinumArcJson },
  parameters: {
    docs: {
      description: {
        component: 'Full-width Webview above Graphview with a draggable 60/40 height split. Use Up/Down on the divider to resize with the keyboard. Either viewer can collapse to its title bar or open as a popup. A compact ARC header and investigation popup buttons keep most of the space available to the viewers. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof SampleSplitDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
