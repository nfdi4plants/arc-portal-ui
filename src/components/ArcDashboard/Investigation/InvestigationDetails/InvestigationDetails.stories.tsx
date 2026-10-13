import type { Meta, StoryObj } from '@storybook/react-vite'
import { Dashlet } from '../../../DashboardWindow'
import { TalinumStory } from '../../../../storybook/TalinumStory'
import { InvestigationDetails } from './InvestigationDetails'

function SampleInvestigationDetails() {
  return (
    <TalinumStory>{(metadata) => (
      <div className="dashboard-window-container">
        <Dashlet title={metadata.title} maxWidth={620}><InvestigationDetails metadata={metadata} /></Dashlet>
      </div>
    )}</TalinumStory>
  )
}

const meta = {
  title: 'InvestigationDetails',
  component: SampleInvestigationDetails,
  parameters: { docs: { description: { component: 'Investigation dashlet titled with the ARC title, with Overview, Contacts, Organizations, and Publications tabs. All lists reuse MetadataList.' } } },
} satisfies Meta<typeof SampleInvestigationDetails>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Talinum ARC' }
