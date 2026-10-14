import { useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { DashboardContentProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import './viewerWorkspace.css'

export type ViewerWorkspaceMode = 'webview' | 'graphview' | 'compare'
const clampShare = (share: number) => Math.max(20, Math.min(80, share))

/** Keep the same viewers mounted in single-view and comparison modes. */
export function ViewerWorkspace({ metadata, arcJson, provenance, mode = 'compare', firstViewer = 'webview' }: Pick<DashboardContentProps, 'metadata' | 'arcJson' | 'provenance'> & {
  mode?: ViewerWorkspaceMode
  firstViewer?: 'webview' | 'graphview'
}) {
  const [webviewShare, setWebviewShare] = useState(60)
  const [collapsed, setCollapsed] = useState<'webview' | 'graphview' | null>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const webviewId = useId()
  const graphviewId = useId()
  const compare = mode === 'compare'
  const graphFirst = firstViewer === 'graphview'
  const firstShare = graphFirst ? 100 - webviewShare : webviewShare
  const firstTitle = graphFirst ? 'Graphview' : 'Webview'
  const secondTitle = graphFirst ? 'Webview' : 'Graphview'
  const effectiveCollapsed = compare ? collapsed : null
  const togglePane = (pane: 'webview' | 'graphview') => setCollapsed(current => current === pane ? null : pane)
  const releaseDivider = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const webviewPane = (
    <div key="webview" id={webviewId} className="split-dashboard-pane" hidden={mode === 'graphview'}>
      <InvestigationDashlets metadata={metadata} arcJson={arcJson} classNamePrefix="split-dashboard" ids={['webview']} interactive collapsed={mode === 'graphview' || effectiveCollapsed === 'webview'} onToggleCollapsed={compare ? () => togglePane('webview') : undefined} />
    </div>
  )
  const graphviewPane = (
    <div key="graphview" id={graphviewId} className="split-dashboard-pane" hidden={mode === 'webview'}>
      <PopupGraphview
        index={provenance}
        label="Graphview"
        className="split-dashboard-graphview"
        expandOnClick={false}
        collapsed={mode === 'webview' || effectiveCollapsed === 'graphview'}
        onToggleCollapsed={compare ? () => togglePane('graphview') : undefined}
      />
    </div>
  )

  return (
    <div
      ref={workspace}
      className="split-dashboard-workspace"
      data-view-mode={mode}
      data-first-viewer={firstViewer}
      data-collapsed={effectiveCollapsed ?? undefined}
      style={{ '--first-viewer-share': `${firstShare}fr`, '--second-viewer-share': `${100 - firstShare}fr` } as CSSProperties}
    >
      {graphFirst ? graphviewPane : webviewPane}
      <div
        role="separator"
        aria-label={`Resize ${firstTitle} and ${secondTitle}`}
        aria-orientation="horizontal"
        aria-controls={graphFirst ? `${graphviewId} ${webviewId}` : `${webviewId} ${graphviewId}`}
        aria-valuemin={20}
        aria-valuemax={80}
        aria-valuenow={Math.round(firstShare)}
        aria-valuetext={`${firstTitle} ${Math.round(firstShare)}%, ${secondTitle} ${Math.round(100 - firstShare)}%`}
        aria-disabled={!!effectiveCollapsed || undefined}
        tabIndex={effectiveCollapsed ? -1 : 0}
        className="split-dashboard-divider"
        hidden={!compare}
        onPointerDown={(event) => {
          if (effectiveCollapsed || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.focus()
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (effectiveCollapsed || !event.currentTarget.hasPointerCapture(event.pointerId)) return
          const rect = workspace.current?.getBoundingClientRect()
          if (rect && rect.height > 12) {
            const share = clampShare((event.clientY - rect.top - 6) / (rect.height - 12) * 100)
            setWebviewShare(graphFirst ? 100 - share : share)
          }
        }}
        onPointerUp={releaseDivider}
        onPointerCancel={releaseDivider}
        onKeyDown={(event) => {
          if (effectiveCollapsed) return
          const changes: Record<string, number> = { ArrowUp: -5, ArrowDown: 5 }
          if (event.key in changes) {
            event.preventDefault()
            setWebviewShare(current => clampShare(current + (graphFirst ? -changes[event.key] : changes[event.key])))
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            const share = event.key === 'Home' ? 20 : 80
            setWebviewShare(graphFirst ? 100 - share : share)
          }
        }}
      />
      {graphFirst ? webviewPane : graphviewPane}
    </div>
  )
}
