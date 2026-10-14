import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { ViewerWorkspace } from '../../components/ArcDashboard/ViewerWorkspace/ViewerWorkspace'
import './viewerDashboard.css'
import './hubDashboard.css'

function HubDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="viewer-dashboard hub-dashboard">
      {actions && <div className="viewer-dashboard-actions">{actions}</div>}
      <div className="hub-dashboard-overview">
        <nav className="hub-dashboard-metadata hub-dashboard-left" aria-label="Description, contacts, and organizations">
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="hub-dashboard" ids={['description', 'contacts', 'organizations']} />
        </nav>
        <div className="hub-dashboard-hub">
          <ArcDetails {...props} metadata={metadata} />
        </div>
        <nav className="hub-dashboard-metadata hub-dashboard-right" aria-label="Publications, assays, and studies">
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="hub-dashboard" ids={['publications', 'assays', 'studies']} />
        </nav>
      </div>
      <ViewerWorkspace metadata={metadata} provenance={provenance} arcJson={props.arcJson} />
    </main>
  )
}

const meta = {
  title: 'HubDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: HubDashboardLayout, label: 'HubDashboard', fillHeight: false },
  parameters: {
    docs: {
      description: {
        component: 'A compact circular ARC header between two stacks of investigation popup cards. Full-width Webview and Graphview fill the remaining height with a resizable 60/40 split. On narrow screens, the metadata cards move below the circle. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
