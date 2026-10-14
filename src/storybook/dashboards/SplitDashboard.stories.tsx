import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { investigationDetailIds } from '../../components/ArcDashboard/InvestigationDashlets/investigationDashletOptions'
import { ViewerWorkspace } from '../../components/ArcDashboard/ViewerWorkspace/ViewerWorkspace'
import './viewerDashboard.css'
import './splitDashboard.css'

function SplitDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="viewer-dashboard split-dashboard">
      {actions && <div className="viewer-dashboard-actions split-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <nav className="split-dashboard-metadata" aria-label="Investigation dashlets">
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="split-dashboard" ids={investigationDetailIds} />
      </nav>
      <ViewerWorkspace metadata={metadata} provenance={provenance} arcJson={props.arcJson} />
    </main>
  )
}

const meta = {
  title: 'SplitDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: SplitDashboardLayout, label: 'SplitDashboard', fillHeight: false },
  parameters: {
    docs: {
      description: {
        component: 'Full-width Webview above Graphview with a draggable 60/40 height split. Use Up/Down on the divider to resize with the keyboard. Either viewer can collapse to its title bar or open as a popup. A compact ARC header and investigation popup buttons keep most of the space available to the viewers. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
