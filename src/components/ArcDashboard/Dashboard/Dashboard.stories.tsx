import type { Meta, StoryObj } from '@storybook/react-vite'
import { TalinumStory } from '../../../storybook/TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { Dashboard, type DashboardProps } from './Dashboard'

function SampleArcDashboard(props: DashboardProps) {
  return <TalinumStory>{() => <Dashboard {...props} />}</TalinumStory>
}

const meta = {
  title: 'Dashboard',
  component: SampleArcDashboard,
  args: {
    repository: talinumRepository,
    arcJson: talinumArcJson,
  },
  parameters: {
    docs: {
      description: {
        component: 'ARC summary header above two matching dashlets: investigation tabs titled with the ARC title, and ArcWebView. Each dashlet includes corner buttons to open it in a new tab or as a popup.',
      },
    },
  },
} satisfies Meta<typeof SampleArcDashboard>

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
