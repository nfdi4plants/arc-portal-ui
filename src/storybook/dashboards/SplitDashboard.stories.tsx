import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { SplitDashboardLayout } from './SplitDashboardLayout'

const meta = {
  title: 'Dashboard/SplitDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: SplitDashboardLayout, label: 'SplitDashboard', fillHeight: false },
  parameters: {
    docs: {
      description: {
        component: 'Full-width Graphview above Webview with a draggable 40/60 height split. Use Up/Down on the divider to resize with the keyboard. Either viewer can collapse to its title bar or open as a popup. A compact ARC header, investigation dropdown buttons, and an ARCade button that opens the game keep most of the space available to the viewers. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
