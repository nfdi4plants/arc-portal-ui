import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { SplitDashboardLayout } from './SplitDashboardLayout'

const meta = {
  title: 'Dashboard/ScrollingSplitDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: {
    repository: talinumRepository,
    arcJson: talinumArcJson,
    content: (props: DashboardContentProps) => <SplitDashboardLayout {...props} scrolling />,
    label: 'ScrollingSplitDashboard',
    fillHeight: false,
  },
  parameters: {
    docs: {
      description: { component: 'A resizable Graphview/Webview split inside an outer scrolling container. The ARC header and investigation toolbar stay visible while scrolling through the taller viewers. Collapse and popup controls remain available for both viewers. At a viewer\'s vertical edge, scrolling continues in the surrounding dashboard.' },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
