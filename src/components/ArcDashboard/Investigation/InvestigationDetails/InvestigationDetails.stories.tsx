import type { Meta, StoryObj } from '@storybook/react-vite'
import { Dashlet, DashboardWindow } from '../../../DashboardWindow'
import { TalinumStory } from '../../../../storybook/TalinumStory'
import { InvestigationDetails } from './InvestigationDetails'

function SampleInvestigationDetails() {
  return (
    <TalinumStory>{(metadata) => (
      <DashboardWindow label="Investigation preview" maxWidth={620}>
        <Dashlet label="Investigation details"><InvestigationDetails metadata={metadata} /></Dashlet>
      </DashboardWindow>
    )}</TalinumStory>
  )
}

const meta = {
  title: 'InvestigationDetails',
  component: SampleInvestigationDetails,
  parameters: { docs: { description: { component: 'Investigation dashlet with clickable Overview previews and full Description, Contacts, Organizations, Publications, Assays, and Studies tabs. All lists reuse MetadataList.' } } },
} satisfies Meta<typeof SampleInvestigationDetails>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Talinum ARC' }
