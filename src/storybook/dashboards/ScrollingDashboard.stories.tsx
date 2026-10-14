import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@primer/react'
import { useRef } from 'react'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationDashlets } from '../../components/ArcDashboard/InvestigationDashlets/InvestigationDashlets'
import { InvestigationMenu } from '../../components/ArcDashboard/InvestigationMenu/InvestigationMenu'
import { PopupGraphview } from '../../components/ArcDashboard/Provenance/PopupGraphview'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { PopupArcGame } from './PopupArcGame'
import './viewerDashboard.css'
import './scrollingDashboard.css'

function ScrollingDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  const header = useRef<HTMLElement>(null)
  const webview = useRef<HTMLElement>(null)
  const graphview = useRef<HTMLElement>(null)
  const game = useRef<HTMLElement>(null)
  const jumpTo = (section: HTMLElement | null) => {
    if (!section) return
    section.style.scrollMarginTop = `${(header.current?.getBoundingClientRect().height ?? 0) + 16}px`
    section.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    section.focus({ preventScroll: true })
  }

  return (
    <main className="viewer-dashboard scrolling-dashboard">
      <header ref={header} className="scrolling-dashboard-header">
        {actions && <div className="viewer-dashboard-actions">{actions}</div>}
        <ArcDetails {...props} metadata={metadata} />
        <nav className="scrolling-dashboard-navigation" aria-label="Viewer navigation">
          <Button onClick={() => jumpTo(webview.current)}>Jump to Webview</Button>
          <Button onClick={() => jumpTo(graphview.current)}>Jump to Graphview</Button>
          {provenance && <Button onClick={() => jumpTo(game.current)}>Jump to ARCade</Button>}
          <InvestigationMenu metadata={metadata} arcJson={props.arcJson} />
        </nav>
      </header>
      <section ref={webview} tabIndex={-1} aria-label="Webview section" className="scrolling-dashboard-viewer">
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="scrolling-dashboard" ids={['webview']} interactive />
      </section>
      <section ref={graphview} tabIndex={-1} aria-label="Graphview section" className="scrolling-dashboard-viewer">
        <PopupGraphview index={provenance} label="Graphview" className="scrolling-dashboard-graphview" expandOnClick={false} />
      </section>
      {provenance && <section ref={game} tabIndex={-1} aria-label="ARCade section" className="scrolling-dashboard-viewer scrolling-dashboard-game">
        <PopupArcGame index={provenance} arcTitle={metadata.title} />
      </section>}
    </main>
  )
}

const meta = {
  title: 'ScrollingDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: ScrollingDashboardLayout, label: 'ScrollingDashboard', fillHeight: false },
  parameters: { docs: { description: {
    component: 'A continuous scrolling dashboard with a sticky ARC header and Investigation menu. Full-width Webview and Graphview each occupy 75% of the viewport height, with a minimum height of 360px. Jump buttons scroll to a viewer and move keyboard focus there. Both viewers stay mounted and retain popup controls. A compact ARCade card below them expands into the game. Uses the bundled Talinum ARC without DataHub requests.',
  } } },
} satisfies Meta<typeof ArcDashboardFrame>

export default meta
type Story = StoryObj<typeof meta>

export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
