import { Banner, Spinner, Stack, Text } from '@primer/react'
import { useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useArcSelector, useArcStatus } from '../../../arc/hooks'
import { buildProvenanceIndex } from '../../../arc/provenance/buildIndex'
import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { DashboardWindow } from '../../DashboardWindow'
import { PopupDashlet } from '../../PopupDashlet'
import { ArcDetails } from '../ArcDetails'
import type { DashboardProps } from '../Dashboard'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import type { InvestigationMetadata } from '../Investigation/types'
import { ProvenanceExplorer } from '../Provenance/ProvenanceExplorer'
import './splitDashboard.css'

const sameIndex = (a: unknown, b: unknown) => a === b
const clampShare = (share: number) => Math.max(20, Math.min(80, share))
export type SplitDashboardProps = DashboardProps

export function SplitDashboardContent({ metadata, provenance, actions, ...props }: SplitDashboardProps & {
  metadata: InvestigationMetadata
  provenance?: ProvenanceIndex
  actions?: ReactNode
}) {
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
          <PopupDashlet
            title="Graphview"
            description="Explore connections between datasets, experimental processes, and their inputs and outputs."
            label="Graphview"
            className="split-dashboard-graphview"
            expandOnClick={false}
            collapsed={collapsed === 'graphview'}
            onToggleCollapsed={() => togglePane('graphview')}
          >
            {provenance ? <ProvenanceExplorer index={provenance} embedded /> : <Text as="p">No provenance data available.</Text>}
          </PopupDashlet>
        </div>
      </div>
    </main>
  )
}

export function SplitDashboard(props: SplitDashboardProps) {
  const status = useArcStatus()
  const metadata = useArcSelector(selectInvestigationMetadata)
  const provenance = useArcSelector(buildProvenanceIndex, sameIndex)

  return (
    <DashboardWindow label="SplitDashboard">
      {status.kind === 'error' ? (
        <div className="investigation-feedback">
          <Banner variant="critical" title="Could not load ARC" description={status.error instanceof Error ? status.error.message : String(status.error)} />
        </div>
      ) : !metadata ? (
        <Stack className="investigation-feedback" direction="horizontal" align="center" justify="center" gap="condensed" role="status">
          <Spinner size="large" /><Text as="span">Loading ARC…</Text>
        </Stack>
      ) : (
        <SplitDashboardContent {...props} metadata={metadata} provenance={provenance} />
      )}
    </DashboardWindow>
  )
}
