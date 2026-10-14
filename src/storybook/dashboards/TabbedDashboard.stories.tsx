import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import { TalinumStory } from '../TalinumStory'
import { privateTalinumDataHubData, publicTalinumDataHubData, talinumArcJson, talinumRepository } from '../fixtures/talinumArc'
import { useId, useRef, useState } from 'react'
import { ArcDetails } from '../../components/ArcDashboard/ArcDetails'
import type { DashboardContentProps } from '../../components/ArcDashboard/dashboardTypes'
import { InvestigationMenu } from '../../components/ArcDashboard/InvestigationMenu/InvestigationMenu'
import { ViewerWorkspace, type ViewerWorkspaceMode } from '../../components/ArcDashboard/ViewerWorkspace/ViewerWorkspace'
import './viewerDashboard.css'
import './tabbedDashboard.css'

const views: { id: ViewerWorkspaceMode; title: string }[] = [
  { id: 'webview', title: 'Webview' }, { id: 'graphview', title: 'Graphview' }, { id: 'compare', title: 'Compare' },
]

function TabbedDashboardLayout({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  const [view, setView] = useState<ViewerWorkspaceMode>('webview')
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([])
  const tabId = useId()
  const panelId = useId()

  return (
    <main className="viewer-dashboard tabbed-dashboard">
      {actions && <div className="viewer-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <div className="tabbed-dashboard-controls">
        <div role="tablist" aria-label="Viewer views" className="tabbed-dashboard-tabs">
          {views.map(({ id, title }, index) => <button
            key={id}
            ref={element => { tabButtons.current[index] = element }}
            type="button"
            role="tab"
            id={`${tabId}-${id}`}
            aria-selected={view === id}
            aria-controls={panelId}
            tabIndex={view === id ? 0 : -1}
            onClick={() => setView(id)}
            onKeyDown={(event) => {
              let next: number
              if (event.key === 'ArrowRight') next = (index + 1) % views.length
              else if (event.key === 'ArrowLeft') next = (index + views.length - 1) % views.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = views.length - 1
              else return
              event.preventDefault()
              setView(views[next].id)
              tabButtons.current[next]?.focus()
            }}
          >{title}</button>)}
        </div>
        <InvestigationMenu metadata={metadata} arcJson={props.arcJson} />
      </div>
      <section id={panelId} role="tabpanel" aria-labelledby={`${tabId}-${view}`} className="tabbed-dashboard-viewer-panel">
        <ViewerWorkspace metadata={metadata} provenance={provenance} arcJson={props.arcJson} mode={view} />
      </section>
    </main>
  )
}

const meta = {
  title: 'TabbedDashboard',
  component: ArcDashboardFrame,
  decorators: [(Story) => <TalinumStory>{() => <Story />}</TalinumStory>],
  argTypes: { content: { control: false, table: { disable: true } }, label: { table: { disable: true } }, fillHeight: { table: { disable: true } } },
  args: { repository: talinumRepository, arcJson: talinumArcJson, content: TabbedDashboardLayout, label: 'TabbedDashboard', fillHeight: false },
  parameters: { docs: { description: {
    component: 'Webview and Graphview each use the full workspace in their own tab. Compare shows the shared resizable 60/40 vertical split. Investigation opens metadata popup dashlets from a compact menu. Viewer state and the chosen split survive switching views. Uses the bundled Talinum ARC without DataHub requests.',
  } } },
} satisfies Meta<typeof ArcDashboardFrame>
export default meta
type Story = StoryObj<typeof meta>
export const TalinumArc: Story = { name: 'Without DataHub Access', args: { dataHubData: undefined } }
export const Public: Story = { name: 'Public DataHub Access', args: { dataHubData: publicTalinumDataHubData } }
export const Private: Story = { name: 'Private DataHub Access', args: { dataHubData: privateTalinumDataHubData } }
