import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { NewDashboardContent } from '../../components/ArcDashboard/NewDashboard'

const meta = {
  title: 'NewDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: NewDashboardContent, label: 'NewDashboard', fillHeight: true },
  parameters: {
    docs: {
      description: {
        component: 'Alternate investigation dashboard with a circular ARC header and nine equally sized, compact dashlets: Description, Contacts, Organizations, Publications, Assays, Studies, Webview, Graphview, and the ARCade game. Hover for 1.5 seconds to preview; click to expand over the dashboard. Click outside, press Escape, or use the shrink icon to restore the dashlet. Overview is omitted. The layout stacks on smaller screens. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

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
