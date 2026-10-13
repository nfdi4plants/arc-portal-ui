import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import styles from './GraphCanvas.module.css'
import { layoutGraph, type GraphLayout, type LaidOutEdge, type LaidOutNode, type PlacedPill } from './layout'
import { createTextMeasure, PILL_HEIGHT } from './pills'
import type { CanvasColor, GraphCanvasProps } from './types'

const NO_EXPANSION: ReadonlySet<string> = new Set()

const NODE_RADIUS = 6
const STRIPE_WIDTH = 4
// Where the 4px stripe meets the rounded corner of the node.
const STRIPE_CORNER = NODE_RADIUS - Math.sqrt(NODE_RADIUS ** 2 - (NODE_RADIUS - STRIPE_WIDTH) ** 2)

const CATEGORY_CLASS = {
  characteristic: styles.characteristic,
  factor: styles.factor,
  parameter: styles.parameter,
  component: styles.component,
  protocol: styles.other,
  performer: styles.other,
  date: styles.other,
  comment: styles.other,
}

const ARROWS = [
  { name: 'study', className: styles.study },
  { name: 'assay', className: styles.assay },
  { name: 'run', className: styles.run },
  { name: 'neutral', className: styles.edgeNeutral },
  { name: 'accent', className: styles.accent },
]

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function colorClass(color: CanvasColor, neutral: string): string {
  return color === 'neutral' ? neutral : styles[color]
}

function isActivationKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' '
}

// Left edge of a node: the rounded corners of the node cut a 4px wide stripe.
function stripePath(height: number): string {
  const bottom = height - STRIPE_CORNER
  return `M ${STRIPE_WIDTH} ${STRIPE_CORNER} A ${NODE_RADIUS} ${NODE_RADIUS} 0 0 0 0 ${NODE_RADIUS} V ${height - NODE_RADIUS} A ${NODE_RADIUS} ${NODE_RADIUS} 0 0 0 ${STRIPE_WIDTH} ${bottom} Z`
}

interface PillProps {
  placed: PlacedPill
  highlighted?: boolean
  // "<from> to <to>" of the edge. Toggle pills name it, because several edges have the same toggle.
  owner?: string
  onToggle?: () => void
}

function Pill({ placed, highlighted = false, owner, onToggle }: PillProps) {
  const { view } = placed
  const hasDot = view.category !== undefined
  const valueClass = view.kind === 'process' ? styles.pillStrong : view.empty ? styles.pillEmpty : styles.pillValue
  const colorClassName =
    view.kind === 'process'
      ? highlighted
        ? styles.processHighlighted
        : styles.process
      : view.category && CATEGORY_CLASS[view.category]
  const content = (
    <>
      <title>{view.tooltip}</title>
      <rect className={styles.pillBox} width={view.width} height={PILL_HEIGHT} rx={PILL_HEIGHT / 2} />
      {hasDot && <circle className={styles.pillDot} cx={10} cy={PILL_HEIGHT / 2} r={3} />}
      <text className={styles.pillText} x={hasDot ? 17 : 7} y={PILL_HEIGHT / 2} dominantBaseline="central">
        {view.namePart && <tspan className={styles.pillName}>{view.namePart}</tspan>}
        <tspan className={valueClass}>{view.valuePart}</tspan>
      </text>
    </>
  )
  const transform = `translate(${placed.x} ${placed.y})`

  if (view.toggle && onToggle) {
    const activate = (event: MouseEvent | KeyboardEvent) => {
      event.stopPropagation()
      onToggle()
    }
    return (
      <g
        className={cx(styles.pill, styles.toggle)}
        transform={transform}
        role="button"
        tabIndex={0}
        aria-label={owner ? `${view.tooltip} of ${owner}` : view.tooltip}
        aria-expanded={view.toggle === 'less'}
        onClick={activate}
        onKeyDown={(event) => {
          if (!isActivationKey(event)) return
          event.preventDefault()
          activate(event)
        }}
      >
        {content}
      </g>
    )
  }
  return (
    <g className={cx(styles.pill, colorClassName)} transform={transform} role="img" aria-label={view.tooltip}>
      {content}
    </g>
  )
}

interface NodeProps {
  laid: LaidOutNode
  onClick?: (id: string) => void
}

function NodeShape({ laid, onClick }: NodeProps) {
  const { node, width, height } = laid
  const clickable = onClick !== undefined && node.clickable !== false
  // The pills hold information that a screen reader would otherwise miss. The tooltip is left out,
  // because ariaLabel already carries what it says.
  const label = [node.ariaLabel, ...laid.pills.map(({ view }) => view.fullText)].join(', ')
  const classes = cx(
    colorClass(node.color, styles.nodeNeutral),
    node.dashed && styles.dashed,
    node.emphasized && styles.emphasized,
    node.selected && styles.selected,
    clickable && styles.interactive,
  )
  const interaction = clickable
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: () => onClick(node.id),
        onKeyDown: (event: KeyboardEvent) => {
          if (!isActivationKey(event)) return
          event.preventDefault()
          onClick(node.id)
        },
      }
    : { role: 'group' }
  return (
    <g className={classes} transform={`translate(${laid.x} ${laid.y})`} aria-label={label} {...interaction}>
      <title>{node.tooltip ?? node.title}</title>
      <rect className={styles.nodeFill} width={width} height={height} rx={NODE_RADIUS} />
      <path className={styles.stripe} d={stripePath(height)} />
      <rect className={styles.nodeBorder} width={width} height={height} rx={NODE_RADIUS} />
      <text
        className={cx(styles.title, node.mono && styles.mono)}
        x={15}
        y={laid.titleY}
        dominantBaseline="central"
      >
        {laid.titleText}
      </text>
      {laid.subtitleText && (
        <text className={styles.subtitle} x={15} y={laid.subtitleY} dominantBaseline="central">
          {laid.subtitleText}
        </text>
      )}
      {laid.pills.map((placed) => (
        <Pill key={placed.view.key} placed={placed} />
      ))}
    </g>
  )
}

function arrowName(laid: LaidOutEdge): string {
  if (laid.edge.highlighted) return 'accent'
  return laid.edge.color
}

interface Outcome {
  resetKey: string
  // null when ELK failed.
  layout: GraphLayout | null
}

export function GraphCanvas({
  nodes,
  edges,
  ariaLabel,
  onNodeClick,
  centerNodeId,
  resetKey,
  focusOnMount = false,
}: GraphCanvasProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const scrolledFor = useRef<string | null>(null)
  const markerPrefix = useId().replace(/:/g, '')

  // Expanded edges belong to one resetKey. React lets a component reset state while it
  // renders, so a changed key drops the old expansion before anything is drawn. Returning to an
  // earlier key therefore starts collapsed.
  const [expansion, setExpansion] = useState({ resetKey, ids: NO_EXPANSION })
  if (expansion.resetKey !== resetKey) setExpansion({ resetKey, ids: NO_EXPANSION })
  const expanded = expansion.resetKey === resetKey ? expansion.ids : NO_EXPANSION
  const toggle = useCallback(
    (edgeId: string) => {
      setExpansion((current) => {
        const ids = new Set(current.ids)
        if (!ids.delete(edgeId)) ids.add(edgeId)
        return { resetKey: current.resetKey, ids }
      })
    },
    [],
  )

  // The previous drawing stays until the next layout resolves, unless it belongs to another view.
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  useEffect(() => {
    let current = true
    const family = rootRef.current ? getComputedStyle(rootRef.current).fontFamily : ''
    layoutGraph(nodes, edges, expanded, createTextMeasure(family || 'sans-serif')).then(
      (layout) => {
        if (current) setOutcome({ resetKey, layout })
      },
      (error: unknown) => {
        console.error('Could not lay out the graph canvas', error)
        if (current) setOutcome({ resetKey, layout: null })
      },
    )
    return () => {
      current = false
    }
  }, [nodes, edges, expanded, resetKey])

  const shown = outcome && outcome.resetKey === resetKey ? outcome : null
  const layout = shown?.layout ?? null
  const titles = new Map((layout?.nodes ?? []).map((laid) => [laid.node.id, laid.node.title]))

  // After a navigation the container takes focus, because the focused node is gone. The first
  // mount leaves focus alone unless focusOnMount is set.
  const lastKey = useRef(resetKey)
  const focusOnDraw = useRef(focusOnMount)
  useLayoutEffect(() => {
    if (lastKey.current === resetKey) return
    lastKey.current = resetKey
    focusOnDraw.current = true
  }, [resetKey])

  // A new view starts at the top left, or on centerNodeId. Expanding an edge keeps the scroll position.
  // A failed layout takes the focus too, because the container then shows the alert.
  const failed = shown !== null && layout === null
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || (!layout && !failed) || scrolledFor.current === resetKey) return
    if (focusOnDraw.current) {
      focusOnDraw.current = false
      root.focus({ preventScroll: true })
    }
    if (!layout) return
    scrolledFor.current = resetKey
    root.scrollLeft = 0
    root.scrollTop = 0
    const target = centerNodeId ? layout.nodes.find((laid) => laid.node.id === centerNodeId) : undefined
    if (!target) return
    const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max))
    root.scrollLeft = clamp(target.x + target.width / 2 - root.clientWidth / 2, root.scrollWidth - root.clientWidth)
    root.scrollTop = clamp(target.y + target.height / 2 - root.clientHeight / 2, root.scrollHeight - root.clientHeight)
  }, [layout, failed, resetKey, centerNodeId])

  return (
    <div ref={rootRef} className={styles.root} role="region" aria-label={ariaLabel} tabIndex={-1}>
      {layout ? (
        <svg
          className={styles.svg}
          xmlns="http://www.w3.org/2000/svg"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="group"
        >
          <defs>
            {ARROWS.map(({ name, className }) => (
              <marker
                key={name}
                id={`${markerPrefix}-${name}`}
                className={className}
                markerWidth={8}
                markerHeight={8}
                refX={7}
                refY={4}
                orient="auto"
              >
                <path className={styles.arrowHead} d="M0,0 L8,4 L0,8 z" />
              </marker>
            ))}
          </defs>
          {layout.edges.map((laid) => {
            const owner = `${titles.get(laid.edge.from) ?? laid.edge.from} to ${titles.get(laid.edge.to) ?? laid.edge.to}`
            // A count pill is a bare number, so its tooltip says what is counted. Property pills keep the full
            // text, because their tooltip only adds the category.
            const texts = laid.pills
              .filter(({ view }) => view.kind !== 'toggle')
              .map(({ view }) => (view.kind === 'property' ? view.fullText : (view.tooltip ?? view.fullText)))
            return (
              <g
                key={laid.edge.id}
                role="group"
                aria-label={`From ${owner}${texts.length ? `: ${texts.join(', ')}` : ''}`}
              >
                {laid.path && (
                  <path
                    className={cx(
                      styles.edge,
                      colorClass(laid.edge.color, styles.edgeNeutral),
                      laid.edge.highlighted && styles.highlighted,
                    )}
                    d={laid.path}
                    markerEnd={`url(#${markerPrefix}-${arrowName(laid)})`}
                  >
                    {laid.edge.tooltip && <title>{laid.edge.tooltip}</title>}
                  </path>
                )}
                {laid.pills.map((placed) => (
                  <Pill
                    key={placed.view.key}
                    placed={placed}
                    highlighted={laid.edge.highlighted}
                    owner={owner}
                    onToggle={() => toggle(laid.edge.id)}
                  />
                ))}
              </g>
            )
          })}
          {layout.nodes.map((laid) => (
            <NodeShape key={laid.node.id} laid={laid} onClick={onNodeClick} />
          ))}
        </svg>
      ) : shown ? (
        <p className={styles.status} role="alert">
          Could not lay out this graph.
        </p>
      ) : (
        <p className={styles.status} role="status">
          Laying out…
        </p>
      )}
    </div>
  )
}
