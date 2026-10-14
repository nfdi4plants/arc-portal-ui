import { Button } from '@primer/react'
import { useRef } from 'react'
import { ArcDetails } from '../ArcDetails'
import type { DashboardContentProps } from '../dashboardTypes'
import { PopupArcGame } from '../Game/PopupArcGame'
import { InvestigationDashlets } from '../InvestigationDashlets/InvestigationDashlets'
import { InvestigationMenu } from '../InvestigationMenu/InvestigationMenu'
import { PopupGraphview } from '../Provenance/PopupGraphview'
import '../viewerDashboard.css'
import './scrollingDashboard.css'

export function ScrollingDashboardContent({ metadata, provenance, actions, ...props }: DashboardContentProps) {
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
          <InvestigationMenu metadata={metadata} arcJson={props.arcJson} variant="primary" presentation="submenu" />
          <Button onClick={() => jumpTo(graphview.current)}>Jump to Graphview</Button>
          <Button onClick={() => jumpTo(webview.current)}>Jump to Webview</Button>
          {provenance && <Button onClick={() => jumpTo(game.current)}>Jump to ARCade</Button>}
        </nav>
      </header>
      <section ref={graphview} tabIndex={-1} aria-label="Graphview section" className="scrolling-dashboard-viewer">
        <PopupGraphview index={provenance} label="Graphview" className="scrolling-dashboard-graphview" expandOnClick={false} />
      </section>
      <section ref={webview} tabIndex={-1} aria-label="Webview section" className="scrolling-dashboard-viewer">
        <InvestigationDashlets repository={props.repository} repositoryUrl={props.repositoryUrl} token={props.token} metadata={metadata} arcJson={props.arcJson} classNamePrefix="scrolling-dashboard" ids={['webview']} interactive />
      </section>
      {provenance && <section ref={game} tabIndex={-1} aria-label="ARCade section" className="scrolling-dashboard-viewer scrolling-dashboard-game">
        <PopupArcGame index={provenance} arcTitle={metadata.title} />
      </section>}
    </main>
  )
}
