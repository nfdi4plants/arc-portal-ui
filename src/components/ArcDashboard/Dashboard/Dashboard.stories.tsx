import type { Meta, StoryObj } from '@storybook/react-vite'
import { withTalinumStory } from '../../../storybook/withTalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { Dashboard } from './Dashboard'

const SampleArcDashboard = withTalinumStory(Dashboard)

const meta = {
  title: 'Dashboard/ClassicDashboard',
  component: SampleArcDashboard,
  args: {
    repository: talinumRepository,
    arcJson: talinumArcJson,
    // Repository metadata stays visible; bundled stories do not fetch GitLab file sizes.
    repositoryUrl: '',
  },
  parameters: {
    docs: {
      description: {
        component: 'ARC summary above matching dashlets using the shared DataHub dashboard styling: investigation details, ArcWebView, and the provenance explorer. All scenarios use the same bundled Talinum ARC with caller-supplied public, private, or unavailable DataHub information. Investigation and viewer dashlets include pop-out buttons to open them in separate browser windows. These stories make no DataHub requests.',
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
