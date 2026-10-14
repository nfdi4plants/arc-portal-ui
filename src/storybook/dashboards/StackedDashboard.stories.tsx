import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { Text } from '@primer/react'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../../components/ArcDashboard/Provenance/PopupGraphview'
import './stackedDashboard.css'

function StackedDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="stacked-dashboard">
      {actions && <div className="stacked-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <div className="stacked-dashboard-body">
        <aside className="stacked-dashboard-cards" aria-label="Investigation dashlets">
          <InvestigationDashlets repository={props.repository} repositoryUrl={props.repositoryUrl} token={props.token} metadata={metadata} arcJson={props.arcJson} classNamePrefix="stacked-dashboard" />
        </aside>
        {provenance ? (
          <PopupGraphview
            index={provenance}
            className="stacked-dashboard-graphview"
            showHeader={false}
            expandOnClick={false}
          />
        ) : (
          <section className="stacked-dashboard-graphview" aria-label="Graphview"><Text as="p">No provenance data available.</Text></section>
        )}
      </div>
    </main>
  )
}

const meta = {
  title: 'Dashboard/StackedDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: StackedDashboardLayout, label: 'StackedDashboard', fillHeight: false },
  parameters: {
    docs: {
      description: {
        component: 'Flat ARC header above an index-card stack occupying one quarter of the dashboard width. The shared investigation popup dashlets keep all seven titles visible; click a card to expand it. Graphview fills the remaining three quarters. On narrow screens Graphview sits above the stack. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
