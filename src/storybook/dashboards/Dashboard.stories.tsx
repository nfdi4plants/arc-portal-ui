import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@primer/react'
import { useState } from 'react'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { DashboardContent } from '../../components/ArcDashboard/Dashboard'
import type { DashboardProps } from '../../components/ArcDashboard/dashboardTypes'
import { TalinumStory } from '../TalinumStory'
import { publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import scrolling from './ScrollingDashboard.stories'
import split from './SplitDashboard.stories'
import scrollingSplit from './ScrollingSplitDashboard.stories'
import tabbed from './TabbedDashboard.stories'
import hub from './HubDashboard.stories'
import combined from './CombinedDashboard.stories'
import stacked from './StackedDashboard.stories'
import circular from './NewDashboard.stories'
import './dashboardDesigns.css'

const designs = [
  { name: 'ScrollingDashboard', content: scrolling.args.content, fillHeight: false },
  { name: 'SplitDashboard', content: split.args.content, fillHeight: false },
  { name: 'TabbedDashboard', content: tabbed.args.content, fillHeight: false },
  { name: 'ScrollingSplitDashboard', content: scrollingSplit.args.content, fillHeight: false },
  { name: 'HubDashboard', content: hub.args.content, fillHeight: false },
  { name: 'CombinedDashboard', content: combined.args.content, fillHeight: false },
  { name: 'StackedDashboard', content: stacked.args.content, fillHeight: false },
  { name: 'NewDashboard', content: circular.args.content, fillHeight: true },
  { name: 'ClassicDashboard', content: DashboardContent, fillHeight: false },
] as const

function DashboardDesigns(props: DashboardProps) {
  const [selected, setSelected] = useState<(typeof designs)[number]['name']>('ScrollingDashboard')
  const design = designs.find(candidate => candidate.name === selected)!

  return (
    <>
      <nav className="dashboard-designs-navigation" aria-label="Dashboard designs">
        {designs.map(({ name }) => <Button key={name} variant={selected === name ? 'primary' : 'default'} aria-pressed={selected === name} onClick={() => setSelected(name)}>{name}</Button>)}
      </nav>
      <ArcDashboardFrame key={selected} {...props} label={design.name} content={design.content} fillHeight={design.fillHeight} />
    </>
  )
}

const meta = {
  title: 'Dashboard',
  component: DashboardDesigns,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  args: { repository: talinumRepository, arcJson: talinumArcJson, repositoryUrl: '', dataHubData: publicTalinumDataHubData },
  argTypes: { arcJson: { control: false, table: { disable: true } }, repositoryUrl: { table: { disable: true } } },
  parameters: { docs: { description: {
    component: 'Explore all ARC dashboard designs with the same bundled Talinum ARC, including ScrollingSplitDashboard with its taller resizable viewers and sticky header. Scrolling, Split, and Tabbed are listed first and present Graphview before Webview. Select a design above its preview, or use the individual dashboard stories for public, private, and unavailable DataHub variants.',
  } } },
} satisfies Meta<typeof DashboardDesigns>

export default meta
type Story = StoryObj<typeof meta>

export const Main: Story = {}
