import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../../components/ArcDashboard/Provenance/PopupGraphview'
import './combinedDashboard.css'

function CombinedDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  return (
    <main className="combined-dashboard">
      {actions && <div className="combined-dashboard-actions">{actions}</div>}
      <div className="combined-dashboard-layout">
        <div className="combined-dashboard-top">
          <div className="combined-dashboard-details">
            <ArcDetails {...props} metadata={metadata} />
            <section className="combined-dashboard-row" aria-label="Description, contacts, and organizations">
              <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="combined-dashboard" ids={['description', 'contacts', 'organizations']} />
            </section>
            <section className="combined-dashboard-row" aria-label="Publications, assays, and studies">
              <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="combined-dashboard" ids={['publications', 'assays', 'studies']} />
            </section>
          </div>
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="combined-dashboard" ids={['webview']} interactive />
        </div>
        <PopupGraphview
          index={provenance}
          label="Graphview"
          className="combined-dashboard-graphview"
          expandOnClick={false}
        />
      </div>
    </main>
  )
}

const meta = {
  title: 'CombinedDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: CombinedDashboardLayout, label: 'CombinedDashboard', fillHeight: false },
  parameters: {
    docs: {
      description: {
        component: 'The ARC header and two overlapping card rows occupy one third of the parent width. Together with Webview, the upper area occupies half of the parent height; Graphview fills the width below. Narrow card rows scroll horizontally. Uses the bundled Talinum ARC without DataHub requests.',
      },
    },
  },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
