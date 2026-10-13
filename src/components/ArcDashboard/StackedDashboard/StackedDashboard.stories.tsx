import type { Meta, StoryObj } from '@storybook/react-vite'
import { TalinumStory } from '../../../storybook/TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { StackedDashboard, type StackedDashboardProps } from './StackedDashboard'

function SampleStackedDashboard(props: StackedDashboardProps) {
  return <TalinumStory>{() => <StackedDashboard {...props} />}</TalinumStory>
}

const meta = {
  title: 'StackedDashboard',
  component: SampleStackedDashboard,
  args: { repository: talinumRepository, arcJson: talinumArcJson },
  parameters: {
    docs: {
      description: {
        component: 'Flat ARC header above an index-card stack occupying one quarter of the dashboard width. The shared investigation popup dashlets keep all seven titles visible; click a card to expand it. Graphview fills the remaining three quarters. On narrow screens Graphview sits above the stack. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof SampleStackedDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
