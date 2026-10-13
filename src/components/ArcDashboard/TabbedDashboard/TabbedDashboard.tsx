import { ActionList, ActionMenu, Button } from '@primer/react'
import { useId, useRef, useState } from 'react'
import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { investigationDashletTitles, investigationDetailIds, type InvestigationDashletId } from '../InvestigationDashlets/investigationDashletOptions'
import { ViewerWorkspace, type ViewerWorkspaceMode } from '../ViewerWorkspace/ViewerWorkspace'
import '../viewerDashboard.css'
import './tabbedDashboard.css'

const views: { id: ViewerWorkspaceMode; title: string }[] = [
  { id: 'webview', title: 'Webview' }, { id: 'graphview', title: 'Graphview' }, { id: 'compare', title: 'Compare' },
]
export type TabbedDashboardProps = DashboardProps

export function TabbedDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  const [view, setView] = useState<ViewerWorkspaceMode>('webview')
  const [investigation, setInvestigation] = useState<InvestigationDashletId | null>(null)
  const investigationButton = useRef<HTMLButtonElement>(null)
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
        <ActionMenu anchorRef={investigationButton}>
          <ActionMenu.Anchor><Button>Investigation</Button></ActionMenu.Anchor>
          <ActionMenu.Overlay>
            <ActionList>
              {investigationDetailIds.map(id => <ActionList.Item key={id} onSelect={() => setInvestigation(id)}>{investigationDashletTitles[id]}</ActionList.Item>)}
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
      <section id={panelId} role="tabpanel" aria-labelledby={`${tabId}-${view}`} className="tabbed-dashboard-viewer-panel">
        <ViewerWorkspace metadata={metadata} provenance={provenance} arcJson={props.arcJson} mode={view} />
      </section>
      <div className="tabbed-dashboard-investigation-popups">
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="tabbed-dashboard" ids={investigationDetailIds}
          externalPopup={{ activeId: investigation, onClose: () => setInvestigation(null), returnFocusRef: investigationButton }}
        />
      </div>
    </main>
  )
}

export function TabbedDashboard(props: TabbedDashboardProps) {
  return <ArcDashboardFrame {...props} label="TabbedDashboard" content={TabbedDashboardContent} />
}
