import { useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { DashboardContentProps } from '../dashboardTypes'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import './viewerWorkspace.css'

export type ViewerWorkspaceMode = 'webview' | 'graphview' | 'compare'
const clampShare = (share: number) => Math.max(20, Math.min(80, share))

/** Keep the same viewers mounted in single-view and comparison modes. */
export function ViewerWorkspace({ metadata, arcJson, provenance, mode = 'compare' }: Pick<DashboardContentProps, 'metadata' | 'arcJson' | 'provenance'> & { mode?: ViewerWorkspaceMode }) {
  const [webviewShare, setWebviewShare] = useState(60)
  const [collapsed, setCollapsed] = useState<'webview' | 'graphview' | null>(null)
  const workspace = useRef<HTMLDivElement>(null)
  const webviewId = useId()
  const graphviewId = useId()
  const compare = mode === 'compare'
  const effectiveCollapsed = compare ? collapsed : null
  const togglePane = (pane: 'webview' | 'graphview') => setCollapsed(current => current === pane ? null : pane)
  const releaseDivider = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      ref={workspace}
      className="split-dashboard-workspace"
      data-view-mode={mode}
      data-collapsed={effectiveCollapsed ?? undefined}
      style={{ '--webview-share': `${webviewShare}fr`, '--graphview-share': `${100 - webviewShare}fr` } as CSSProperties}
    >
      <div id={webviewId} className="split-dashboard-pane" hidden={mode === 'graphview'}>
        <InvestigationDashlets metadata={metadata} arcJson={arcJson} classNamePrefix="split-dashboard" ids={['webview']} interactive collapsed={mode === 'graphview' || effectiveCollapsed === 'webview'} onToggleCollapsed={compare ? () => togglePane('webview') : undefined} />
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
          if (rect && rect.height > 12) setWebviewShare(clampShare((event.clientY - rect.top - 6) / (rect.height - 12) * 100))
        }}
        onPointerUp={releaseDivider}
        onPointerCancel={releaseDivider}
        onKeyDown={(event) => {
          if (effectiveCollapsed) return
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
      <div id={graphviewId} className="split-dashboard-pane" hidden={mode === 'webview'}>
        <PopupGraphview
          index={provenance}
          label="Graphview"
          className="split-dashboard-graphview"
          expandOnClick={false}
          collapsed={mode === 'webview' || effectiveCollapsed === 'graphview'}
          onToggleCollapsed={compare ? () => togglePane('graphview') : undefined}
        />
      </div>
    </div>
  )
}
