import { PortalContext, registerPortalRoot } from '@primer/react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { PopupDashletModeContext, type PopupDashletMode } from './PopupDashletContext'
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
  collapsed?: boolean
  onToggleCollapsed?: () => void
  /** Control a full popup from an external trigger. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  returnFocusRef?: RefObject<HTMLElement | null>
  /** Replace compact content with a symbol; preserve the content's state while hidden. */
  symbol?: ReactNode
  children: ReactNode
}

export function PopupDashlet({ title, description, label, className, showHeader = true, expandOnClick = true, collapsed = false, onToggleCollapsed, open, onOpenChange, returnFocusRef, symbol, children }: PopupDashletProps) {
  const [localMode, setMode] = useState<PopupDashletMode>('compact')
  const mode = open === undefined ? localMode : open ? 'expanded' : 'compact'
  const expanded = mode === 'expanded'
  const focused = mode !== 'compact'
  const [collapsing, setCollapsing] = useState(false)
  const [bounds, setBounds] = useState<CSSProperties>()
  const tile = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDialogElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const previousMode = useRef<PopupDashletMode>('compact')
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const previewOrigin = useRef({ x: 0, y: 0 })
  const headerVisible = showHeader || focused
  const Controls = headerVisible ? 'header' : 'div'
  const portalName = useId()
  const portalContext = useMemo(() => ({ portalContainerName: portalName }), [portalName])
  const registerOverlays = useCallback((root: HTMLDivElement | null) => {
    if (root) registerPortalRoot(root, portalName)
  }, [portalName])

  const dashboardBounds = useCallback(() => {
    const dashboard = tile.current?.closest('.dashboard-window')
    const rect = dashboard?.getBoundingClientRect()
    const top = Math.max(12, (rect?.top ?? 0) + 12)
    const left = Math.max(12, (rect?.left ?? 0) + 12)
    return {
      top, left,
      width: Math.max(0, Math.min(window.innerWidth - 12, (rect?.right ?? window.innerWidth) - 12) - left),
      height: Math.max(0, Math.min(window.innerHeight - 12, (rect?.bottom ?? window.innerHeight) - 12) - top),
    }
  }, [])

  const fitDashboard = useCallback(() => {
    const full = dashboardBounds()
    if (mode === 'preview') {
      const width = full.width / 3
      const height = full.height / 3
      setBounds({ width, height,
        left: Math.max(8, Math.min(window.innerWidth - width - 8, previewOrigin.current.x - width / 2)),
        top: Math.max(8, Math.min(window.innerHeight - height - 8, previewOrigin.current.y - height / 2)),
      })
    } else setBounds(full)
  }, [dashboardBounds, mode])

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
    clearTimeout(hoverTimer.current)
    setBounds(dashboardBounds())
    if (open === undefined) setMode('expanded')
    onOpenChange?.(true)
  }

  const shrink = () => {
    if (!expanded) { setMode('compact'); return }
    if (closing.current) return
    closing.current = true
    setCollapsing(true)
    const finish = () => {
      closing.current = false
      setCollapsing(false)
      setMode('compact')
      onOpenChange?.(false)
    }
    const animation = animatePopup(true)
    if (animation) void animation.finished.then(finish, finish)
    else finish()
  }

  useLayoutEffect(() => {
    const dialog = panel.current
    if (!dialog) return
    if (previousMode.current === 'preview') dialog.hidePopover()
    if (expanded) {
      if (open !== undefined) fitDashboard()
      // The same dialog and content move into the browser's modal layer.
      dialog.close()
      dialog.showModal()
      animatePopup(false)
    } else if (mode === 'preview') {
      fitDashboard()
      const activeElement = document.activeElement
      dialog.showPopover()
      // Dialog popovers focus their first control; a mouse preview must not steal focus.
      if (activeElement instanceof HTMLElement && activeElement !== document.body) activeElement.focus({ preventScroll: true })
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    } else if (previousMode.current === 'expanded') {
      dialog.close()
      dialog.show()
      const focusTarget = returnFocusRef?.current ?? toggle.current
      focusTarget?.focus({ preventScroll: true })
    }
    previousMode.current = mode
  }, [mode, expanded, animatePopup, fitDashboard, open, returnFocusRef])

  useEffect(() => {
    if (!focused) return
    window.addEventListener('resize', fitDashboard)
    return () => window.removeEventListener('resize', fitDashboard)
  }, [focused, fitDashboard])

  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  useEffect(() => {
    if (mode !== 'preview') return
    const dismissOutside = (event: PointerEvent) => {
      const dialog = panel.current
      if (!dialog || (event.target instanceof Node && dialog.contains(event.target))) return
      const rect = dialog.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setMode('compact')
    }
    const dismiss = () => setMode('compact')
    document.addEventListener('pointermove', dismissOutside)
    document.addEventListener('pointerleave', dismiss)
    return () => {
      document.removeEventListener('pointermove', dismissOutside)
      document.removeEventListener('pointerleave', dismiss)
    }
  }, [mode])

  return (
    <div ref={tile} className={`dashlet popup-dashlet${className ? ` ${className}` : ''}`}
      onPointerEnter={(event) => {
        if (mode !== 'compact' || !expandOnClick || event.pointerType !== 'mouse') return
        previewOrigin.current = { x: event.clientX, y: event.clientY }
        hoverTimer.current = setTimeout(() => setMode('preview'), 1500)
      }}
      onPointerLeave={() => clearTimeout(hoverTimer.current)}
    >
      <dialog
        ref={panel}
        open
        popover="manual"
        role={focused ? 'dialog' : 'region'}
        aria-label={focused ? title : label ?? title}
        aria-description={description}
        aria-modal={expanded || undefined}
        data-expanded={expanded || undefined}
        data-preview={mode === 'preview' || undefined}
        data-expand-on-click={expandOnClick || undefined}
        className={`popup-dashlet-panel dashboard-component ${surfaces.card}`}
        style={focused ? bounds : undefined}
        onCancel={(event) => { event.preventDefault(); shrink() }}
        onClick={(event) => {
          if (!expanded) {
            if (!expandOnClick) return
            // Viewer controls and portalled sidebars handle their own interactions.
            if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea, [role="button"], [role="treeitem"], .popup-dashlet-overlays')) return
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
        <div ref={registerOverlays} className="popup-dashlet-overlays" inert={(!focused && expandOnClick) || collapsing} />
        <Controls className={headerVisible ? 'dashboard-window-bar popup-dashlet-bar' : 'popup-dashlet-floating-controls'}>
          {headerVisible && <h2 className="dashboard-window-title">{title}</h2>}
          <div className="popup-dashlet-actions">
            {!focused && onToggleCollapsed && <button
              type="button"
              className="popup-dashlet-toggle"
              aria-label={`${collapsed ? 'Restore' : 'Collapse'} ${title}`}
              aria-expanded={!collapsed}
              onClick={(event) => { event.stopPropagation(); onToggleCollapsed() }}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={collapsed ? 'M4 6l4 4 4-4' : 'M4 10l4-4 4 4'} /></svg>
            </button>}
            <button
              ref={toggle}
              type="button"
              className="popup-dashlet-toggle"
              aria-label={`${expanded ? 'Shrink' : 'Expand'} ${title}`}
              aria-expanded={expanded}
              onClick={(event) => { event.stopPropagation(); if (expanded) shrink(); else expand() }}
            >
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d={expanded ? 'M14 6h-4V2M10 6l4-4M2 10h4v4M6 10l-4 4' : 'M10 2h4v4M14 2l-5 5M6 14H2v-4M2 14l5-5'} />
              </svg>
            </button>
          </div>
        </Controls>
        <PopupDashletModeContext.Provider value={collapsing ? 'compact' : collapsed && !focused ? 'collapsed' : mode}>
          <PortalContext.Provider value={portalContext}>
            {!focused && !collapsed && symbol && <div className="popup-dashlet-symbol" role="img" aria-label={`${title} symbol`}>{symbol}</div>}
            <div className="dashboard-component-content" hidden={!focused && (!!symbol || collapsed)} inert={!focused && expandOnClick}>{children}</div>
          </PortalContext.Provider>
        </PopupDashletModeContext.Provider>
      </dialog>
    </div>
  )
}
