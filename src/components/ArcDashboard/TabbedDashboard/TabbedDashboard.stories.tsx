import type { Meta, StoryObj } from '@storybook/react-vite'
import { withTalinumStory } from '../../../storybook/withTalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { TabbedDashboard } from './TabbedDashboard'

const SampleTabbedDashboard = withTalinumStory(TabbedDashboard)
const meta = {
  title: 'TabbedDashboard',
  component: SampleTabbedDashboard,
  args: { repository: talinumRepository, arcJson: talinumArcJson },
  parameters: { docs: { description: {
    component: 'Webview and Graphview each use the full workspace in their own tab. Compare shows the shared resizable 60/40 vertical split. Investigation opens metadata popup dashlets from a compact menu. Viewer state and the chosen split survive switching views. Uses the bundled Talinum ARC without DataHub requests.',
  } } },
} satisfies Meta<typeof SampleTabbedDashboard>
export default meta
type Story = StoryObj<typeof meta>
export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
