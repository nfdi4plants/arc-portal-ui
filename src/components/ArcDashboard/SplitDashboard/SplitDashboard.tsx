import { useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ArcDashboardFrame } from '../ArcDashboardFrame'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps, DashboardProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import './splitDashboard.css'

const clampShare = (share: number) => Math.max(20, Math.min(80, share))
export type SplitDashboardProps = DashboardProps

export function SplitDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
  const [webviewShare, setWebviewShare] = useState(60)
  const [collapsed, setCollapsed] = useState<'webview' | 'graphview' | null>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const webviewId = useId()
  const graphviewId = useId()
  const togglePane = (pane: 'webview' | 'graphview') => setCollapsed(current => current === pane ? null : pane)
  const releaseDivider = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <main className="split-dashboard">
      {actions && <div className="split-dashboard-actions">{actions}</div>}
      <ArcDetails {...props} metadata={metadata} />
      <nav className="split-dashboard-metadata" aria-label="Investigation dashlets">
        <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="split-dashboard" ids={['description', 'contacts', 'organizations', 'publications', 'assays', 'studies']} />
      </nav>
      <div
        ref={workspace}
        className="split-dashboard-workspace"
        data-collapsed={collapsed ?? undefined}
        style={{ '--webview-share': `${webviewShare}fr`, '--graphview-share': `${100 - webviewShare}fr` } as CSSProperties}
      >
        <div id={webviewId} className="split-dashboard-pane">
          <InvestigationDashlets metadata={metadata} arcJson={props.arcJson} classNamePrefix="split-dashboard" ids={['webview']} interactive collapsed={collapsed === 'webview'} onToggleCollapsed={() => togglePane('webview')} />
        </div>
        <div
          role="separator"
          aria-label="Resize Webview and Graphview"
          aria-orientation="horizontal"
          aria-controls={`${webviewId} ${graphviewId}`}
          aria-valuemin={20}
          aria-valuemax={80}
          aria-valuenow={Math.round(webviewShare)}
          aria-valuetext={`Webview ${Math.round(webviewShare)}%, Graphview ${Math.round(100 - webviewShare)}%`}
          aria-disabled={!!collapsed || undefined}
          tabIndex={collapsed ? -1 : 0}
          className="split-dashboard-divider"
          onPointerDown={(event) => {
            if (collapsed || event.button !== 0) return
            event.preventDefault()
            event.currentTarget.focus()
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (collapsed || !event.currentTarget.hasPointerCapture(event.pointerId)) return
            const rect = workspace.current?.getBoundingClientRect()
            if (rect && rect.height > 12) setWebviewShare(clampShare((event.clientY - rect.top - 6) / (rect.height - 12) * 100))
          }}
          onPointerUp={releaseDivider}
          onPointerCancel={releaseDivider}
          onKeyDown={(event) => {
            if (collapsed) return
            const changes: Record<string, number> = { ArrowUp: -5, ArrowDown: 5 }
            if (event.key in changes) {
              event.preventDefault()
              setWebviewShare(current => clampShare(current + changes[event.key]))
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              setWebviewShare(event.key === 'Home' ? 20 : 80)
            }
          }}
        />
        <div id={graphviewId} className="split-dashboard-pane">
          <PopupGraphview
            index={provenance}
            label="Graphview"
            className="split-dashboard-graphview"
            expandOnClick={false}
            collapsed={collapsed === 'graphview'}
            onToggleCollapsed={() => togglePane('graphview')}
          />
        </div>
      </div>
    </main>
  )
}

export function SplitDashboard(props: SplitDashboardProps) {
  return <ArcDashboardFrame {...props} label="SplitDashboard" content={SplitDashboardContent} />
}
