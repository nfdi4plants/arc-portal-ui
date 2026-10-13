import { PortalContext, registerPortalRoot } from '@primer/react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { PopupDashletExpandedContext } from './PopupDashletContext'
import surfaces from '../DashboardWindow/dashboardSurface.module.css'
import '../DashboardWindow/dashboardWindow.css'
import '../DashboardWindow/dashlet.css'
import './popupDashlet.css'

export interface PopupDashletProps {
  title: string
  description: string
  label?: string
  className?: string
  showHeader?: boolean
  expandOnClick?: boolean
  children: ReactNode
}

export function PopupDashlet({ title, description, label, className, showHeader = true, expandOnClick = true, children }: PopupDashletProps) {
  const [expanded, setExpanded] = useState(false)
  const [collapsing, setCollapsing] = useState(false)
  const [bounds, setBounds] = useState<CSSProperties>()
  const tile = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDialogElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const wasExpanded = useRef(false)
  const headerVisible = showHeader || expanded
  const Controls = headerVisible ? 'header' : 'div'
  const portalName = useId()
  const portalContext = useMemo(() => ({ portalContainerName: portalName }), [portalName])
  const registerOverlays = useCallback((root: HTMLDivElement | null) => {
    if (root) registerPortalRoot(root, portalName)
  }, [portalName])

  const fitDashboard = useCallback(() => {
    const dashboard = tile.current?.closest('.dashboard-window')
    const rect = dashboard?.getBoundingClientRect()
    const top = Math.max(12, (rect?.top ?? 0) + 12)
    const left = Math.max(12, (rect?.left ?? 0) + 12)
    setBounds({
      top, left,
      width: Math.max(0, Math.min(window.innerWidth - 12, (rect?.right ?? window.innerWidth) - 12) - left),
      height: Math.max(0, Math.min(window.innerHeight - 12, (rect?.bottom ?? window.innerHeight) - 12) - top),
    })
  }, [])

  const animatePopup = useCallback((shrinking: boolean) => {
    const dialog = panel.current
    const original = tile.current?.getBoundingClientRect()
    if (!dialog || !original || !dialog.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const enlarged = dialog.getBoundingClientRect()
    if (!enlarged.width || !enlarged.height) return
    const compact = {
      transform: `translate(${original.left - enlarged.left}px, ${original.top - enlarged.top}px) scale(${original.width / enlarged.width}, ${original.height / enlarged.height})`,
    }
    const full = { transform: 'none' }
    return dialog.animate(shrinking ? [full, compact] : [compact, full], {
      duration: 180,
      easing: 'ease-out',
    })
  }, [])

  const expand = () => {
    fitDashboard()
    setExpanded(true)
  }

  const shrink = () => {
    if (closing.current) return
    closing.current = true
    setCollapsing(true)
    const finish = () => {
      closing.current = false
      setCollapsing(false)
      setExpanded(false)
    }
    const animation = animatePopup(true)
    if (animation) void animation.finished.then(finish, finish)
    else finish()
  }

  useLayoutEffect(() => {
    const dialog = panel.current
    if (!dialog) return
    if (expanded) {
      // The same dialog and content move into the browser's modal layer.
      dialog.close()
      dialog.showModal()
      animatePopup(false)
      wasExpanded.current = true
    } else if (wasExpanded.current) {
      dialog.close()
      dialog.show()
      toggle.current?.focus({ preventScroll: true })
    }
  }, [expanded, animatePopup])

  useEffect(() => {
    if (!expanded) return
    window.addEventListener('resize', fitDashboard)
    return () => window.removeEventListener('resize', fitDashboard)
  }, [expanded, fitDashboard])

  return (
    <div ref={tile} className={`dashlet popup-dashlet${className ? ` ${className}` : ''}`}>
      <dialog
        ref={panel}
        open
        role={expanded ? 'dialog' : 'region'}
        aria-label={expanded ? title : label ?? title}
        aria-modal={expanded || undefined}
        data-expanded={expanded || undefined}
        data-expand-on-click={expandOnClick || undefined}
        className={`popup-dashlet-panel dashboard-component ${surfaces.card}`}
        style={expanded ? bounds : undefined}
        title={expanded ? undefined : description}
        onCancel={(event) => { event.preventDefault(); shrink() }}
        onClick={(event) => {
          if (!expanded) {
            if (!expandOnClick) return
            // Embedded viewers may activate their own controls during initialization.
            // A user's click on the inert preview targets the panel instead.
            if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return
            expand()
          }
          else if (event.target === event.currentTarget || (
            event.target instanceof Element &&
            event.target.closest('.popup-dashlet-overlays') &&
            event.target.closest('[role="dialog"]') === event.currentTarget
          )) {
            const rect = event.currentTarget.getBoundingClientRect()
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) shrink()
          }
        }}
      >
        <div ref={registerOverlays} className="popup-dashlet-overlays" inert={(!expanded && expandOnClick) || collapsing} />
        <Controls className={headerVisible ? 'dashboard-window-bar popup-dashlet-bar' : 'popup-dashlet-floating-controls'}>
          {showHeader && !expanded && <h2 className="dashboard-window-title">{title}</h2>}
          <button
            ref={toggle}
            type="button"
            className="popup-dashlet-toggle"
            aria-label={`${expanded ? 'Shrink' : 'Expand'} ${title}`}
            aria-expanded={expanded}
            onClick={(event) => { event.stopPropagation(); if (expanded) shrink(); else expand() }}
          >
            {expanded ? 'Smaller' : <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5" /></svg>}
          </button>
        </Controls>
        <PopupDashletExpandedContext.Provider value={expanded && !collapsing}>
          <PortalContext.Provider value={portalContext}>
            <div className="dashboard-component-content" inert={!expanded && expandOnClick}>{children}</div>
          </PortalContext.Provider>
        </PopupDashletExpandedContext.Provider>
      </dialog>
    </div>
  )
}
