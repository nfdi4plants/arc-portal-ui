import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { GraphIcon } from '@primer/octicons-react'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../../components/ArcDashboard/Provenance/PopupGraphview'
import '../../components/ArcDashboard/Investigation/InvestigationDetails/investigationDetails.css'
import './newDashboard.css'

function NewDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="new-dashboard">
      {actions && <div className="new-dashboard-actions">{actions}</div>}
      <div className="new-dashboard-orbit">
        <div className="new-dashboard-hub">
          <ArcDetails {...props} metadata={metadata} />
        </div>
        <InvestigationDashlets repository={props.repository} repositoryUrl={props.repositoryUrl} token={props.token} metadata={metadata} arcJson={props.arcJson} classNamePrefix="new-dashboard" />
        <PopupGraphview index={provenance} symbol={<GraphIcon size={48} />} label="Graphview dashlet" className="new-dashboard-tile new-dashboard-graphview" />
      </div>
    </main>
  )
}

const meta = {
  title: 'NewDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: NewDashboardLayout, label: 'NewDashboard', fillHeight: true },
  parameters: {
    docs: {
      description: {
        component: 'Alternate investigation dashboard with a circular ARC header and ten equally sized, compact dashlets: Description, Contacts, Organizations, Publications, Assays, Studies, Runs, Workflows, Webview, and Graphview. Hover for 1.5 seconds to preview; click to expand over the dashboard. Click outside, press Escape, or use the shrink icon to restore the dashlet. Overview is omitted. The layout stacks on smaller screens. Uses the bundled Talinum ARC without DataHub requests.',
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
