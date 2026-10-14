import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { ScrollingDashboardContent } from '../../components/ArcDashboard/ScrollingDashboard/ScrollingDashboard'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'

const meta = {
  title: 'Dashboard/ScrollingDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: ScrollingDashboardContent, label: 'ScrollingDashboard', fillHeight: false },
  parameters: { docs: { description: {
    component: 'A continuous scrolling dashboard with a sticky ARC header and Investigation menu. Investigation categories open adjacent submenus containing their entities and links. Selecting an assay, study, run, or workflow closes the menus and opens its folder in Webview. Full-width Graphview comes first, followed by Webview. Each viewer occupies 75% of the viewport height, with a minimum height of 360px. Jump buttons scroll to a viewer and move keyboard focus there. Both viewers stay mounted and retain popup controls. A compact ARCade card below them expands into the game. Uses the bundled Talinum ARC without DataHub requests.',
  } } },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
