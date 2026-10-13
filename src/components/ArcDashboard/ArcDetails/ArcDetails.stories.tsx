import type { Meta, StoryObj } from '@storybook/react-vite'
import { DashboardWindow } from '../../DashboardWindow'
import { TalinumStory } from '../../../storybook/TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumRepository } from '../../../storybook/fixtures/talinumArc'
import { ArcDetails, type ArcDetailsProps } from './ArcDetails'

function SampleArcDetails(props: Omit<ArcDetailsProps, 'metadata'>) {
  return (
    <TalinumStory>{(metadata) => (
      <DashboardWindow title="ARC-Dashboard" maxWidth={620}>
        <div style={{ padding: 16 }}><ArcDetails {...props} metadata={metadata} /></div>
      </DashboardWindow>
    )}</TalinumStory>
  )
}

const meta = {
  title: 'ARCDetails',
  component: SampleArcDetails,
  args: { repository: talinumRepository },
  parameters: { docs: { description: { component: 'The dashboard header: ARC title, ownership, visibility, archive size, and DataHub/release links. DataHub information is supplied by the caller.' } } },
} satisfies Meta<typeof SampleArcDetails>

export default meta
type Story = StoryObj<typeof meta>

export const WithoutDataHubAccess: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
