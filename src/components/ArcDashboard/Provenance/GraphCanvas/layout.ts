import type { ELK, ElkLabel, ElkNode } from 'elkjs/lib/elk.bundled.js'
import { edgePillViews, PILL_GAP, PILL_HEIGHT, pillRunWidth, toPillView, type MeasureText, type PillView } from './pills'
import type { CanvasEdge, CanvasNode } from './types'

// Builds the ELK graph from the canvas props and runs ELK. The result holds everything the renderer needs as plain numbers.

export interface Point {
  x: number
  y: number
}

// A pill with the position of its top left corner.
export interface PlacedPill {
  view: PillView
  x: number
  y: number
}

export interface LaidOutNode {
  node: CanvasNode
  x: number
  y: number
  width: number
  height: number
  titleText: string
  subtitleText: string
  // Positions relative to the node origin.
  titleY: number
  subtitleY: number
  pills: PlacedPill[]
}

export interface LaidOutEdge {
  edge: CanvasEdge
  route: Point[]
  path: string
  // Positions relative to the canvas origin.
  pills: PlacedPill[]
}

export interface GraphLayout {
  width: number
  height: number
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
}

const NODE_MIN_WIDTH = 132
const NODE_TEXT_INSET = 15
// A node is at most 320px wide, which leaves 290px for a row of pills.
const PILL_ROW_WIDTH = 290
const TITLE_LIMIT = 42
const SUBTITLE_LIMIT = 48
// ELK spreads the ends of the edges evenly along a node side, so each end gets 28px.
const EDGE_END_SPACING = 28
const CORNER_RADIUS = 6

const ELK_OPTIONS = {
  'org.eclipse.elk.algorithm': 'layered',
  'org.eclipse.elk.direction': 'RIGHT',
  'org.eclipse.elk.edgeRouting': 'ORTHOGONAL',
  'org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers': '40',
  'org.eclipse.elk.spacing.nodeNode': '24',
  'org.eclipse.elk.spacing.edgeNode': '12',
  'org.eclipse.elk.spacing.edgeEdge': '16',
  'org.eclipse.elk.layered.spacing.edgeNodeBetweenLayers': '12',
  'org.eclipse.elk.layered.spacing.edgeEdgeBetweenLayers': '12',
  'org.eclipse.elk.spacing.edgeLabel': '0',
  'org.eclipse.elk.layered.edgeLabels.centerLabelPlacementStrategy': 'MEDIAN_LAYER',
  'org.eclipse.elk.layered.edgeLabels.sideSelection': 'SMART_DOWN',
  'org.eclipse.elk.randomSeed': '1',
  'org.eclipse.elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  // Separate components are packed into rows by size, so widening one label would move whole nodes between layers.
  'org.eclipse.elk.separateConnectedComponents': 'false',
}

const LABEL_OPTIONS = {
  'org.eclipse.elk.edgeLabels.placement': 'CENTER',
  'org.eclipse.elk.edgeLabels.inline': 'true',
}

// ELK is a large bundle, so it loads on the first layout. A failed import is dropped from the cache and the next layout retries it.
let elkPromise: Promise<ELK> | undefined
const getElk = () =>
  (elkPromise ??= import('elkjs/lib/elk.bundled.js')
    .then((m) => new m.default())
    .catch((error) => {
      elkPromise = undefined
      throw error
    }))

function shortText(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

interface NodeBox {
  width: number
  height: number
  titleText: string
  subtitleText: string
  titleY: number
  subtitleY: number
  pills: PlacedPill[]
}

// Pills wrap into rows inside the node. A pill wider than a row widens the node, because pills are never cut.
function measureNode(node: CanvasNode, measure: MeasureText, busiestSide: number): NodeBox {
  const titleText = shortText(node.title, TITLE_LIMIT)
  const subtitleText = node.subtitle ? shortText(node.subtitle, SUBTITLE_LIMIT) : ''
  const titleWidth = measure(titleText, 600, 13, node.mono)
  const subtitleWidth = subtitleText ? measure(subtitleText, 400, 12) : 0
  const textWidth = Math.ceil(Math.max(titleWidth, subtitleWidth) + 34)

  const views = (node.pills ?? []).map((pill) => toPillView(pill, measure))
  const rowWidth = Math.max(PILL_ROW_WIDTH, ...views.map((view) => view.width))
  const rows: PillView[][] = []
  let used = 0
  let widest = 0
  for (const view of views) {
    const current = rows[rows.length - 1]
    if (current && used + PILL_GAP + view.width <= rowWidth) {
      current.push(view)
      used += PILL_GAP + view.width
    } else {
      rows.push([view])
      used = view.width
    }
    widest = Math.max(widest, used)
  }

  const pillTop = subtitleText ? 62 : 46
  const pills = rows.flatMap((row, r) => {
    let x = NODE_TEXT_INSET
    return row.map((view): PlacedPill => {
      const placed = { view, x, y: pillTop + r * (PILL_HEIGHT + PILL_GAP) }
      x += view.width + PILL_GAP
      return placed
    })
  })
  const contentHeight = rows.length
    ? pillTop + rows.length * PILL_HEIGHT + (rows.length - 1) * PILL_GAP + 10
    : subtitleText
      ? 58
      : 42
  const height = busiestSide > 1 ? Math.max(contentHeight, EDGE_END_SPACING * (busiestSide + 1)) : contentHeight
  return {
    width: Math.max(NODE_MIN_WIDTH, textWidth, rows.length ? Math.ceil(widest + 30) : 0),
    height,
    titleText,
    subtitleText,
    titleY: subtitleText || rows.length ? 23 : height / 2,
    subtitleY: 43,
    pills,
  }
}

function countBy(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
}

function toNumber(value: number): number {
  return Math.round(value * 100) / 100
}

// Orthogonal route with rounded corners. The radius shrinks on short segments.
export function roundedPath(points: Point[], radius: number = CORNER_RADIUS): string {
  if (points.length < 2) return ''
  const at = (p: Point) => `${toNumber(p.x)} ${toNumber(p.y)}`
  let d = `M ${at(points[0])}`
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]
    const b = points[i]
    const c = points[i + 1]
    const before = Math.hypot(b.x - a.x, b.y - a.y)
    const after = Math.hypot(c.x - b.x, c.y - b.y)
    const r = Math.min(radius, before / 2, after / 2)
    if (r < 0.5) {
      d += ` L ${at(b)}`
      continue
    }
    const start = { x: b.x + ((a.x - b.x) / before) * r, y: b.y + ((a.y - b.y) / before) * r }
    const end = { x: b.x + ((c.x - b.x) / after) * r, y: b.y + ((c.y - b.y) / after) * r }
    d += ` L ${at(start)} Q ${at(b)} ${at(end)}`
  }
  return `${d} L ${at(points[points.length - 1])}`
}

// y of the horizontal route segment that runs under the label. The label sits on the route
// and, when the route bends, ELK may offer several horizontal segments, so the nearest one wins.
function runY(route: Point[], label: ElkLabel): number {
  const left = label.x ?? 0
  const right = left + (label.width ?? 0)
  const middle = (label.y ?? 0) + (label.height ?? 0) / 2
  let best: number | undefined
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]
    const b = route[i]
    if (Math.abs(a.y - b.y) > 0.5) continue
    if (Math.min(a.x, b.x) > left + 1 || Math.max(a.x, b.x) < right - 1) continue
    if (best === undefined || Math.abs(a.y - middle) < Math.abs(best - middle)) best = a.y
  }
  return best ?? middle
}

export async function layoutGraph(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  expanded: ReadonlySet<string>,
  measure: MeasureText,
): Promise<GraphLayout> {
  const outgoing = countBy(edges.map((edge) => edge.from))
  const incoming = countBy(edges.map((edge) => edge.to))
  const boxes = nodes.map((node) =>
    measureNode(node, measure, Math.max(outgoing.get(node.id) ?? 0, incoming.get(node.id) ?? 0)),
  )
  const views = edges.map((edge) => edgePillViews(edge, expanded.has(edge.id), measure))

  // Each edge with pills gets one inline label as wide as its pill run. ELK widens only that
  // gap, and expanding an edge only changes its label width.
  const graph: ElkNode = {
    id: 'root',
    layoutOptions: ELK_OPTIONS,
    children: nodes.map((node, i) => ({ id: node.id, width: boxes[i].width, height: boxes[i].height })),
    edges: edges.map((edge, i) => ({
      id: edge.id,
      sources: [edge.from],
      targets: [edge.to],
      ...(views[i].length
        ? {
            labels: [
              {
                id: `${edge.id}-pills`,
                text: 'pills',
                width: pillRunWidth(views[i]),
                height: PILL_HEIGHT,
                layoutOptions: LABEL_OPTIONS,
              },
            ],
          }
        : {}),
    })),
  }

  const laid = await (await getElk()).layout(graph)

  const positions = new Map((laid.children ?? []).map((child) => [child.id, child]))
  const routes = new Map((laid.edges ?? []).map((edge) => [edge.id, edge]))

  return {
    width: Math.ceil(laid.width ?? 0),
    height: Math.ceil(laid.height ?? 0),
    nodes: nodes.map((node, i) => ({
      node,
      x: positions.get(node.id)?.x ?? 0,
      y: positions.get(node.id)?.y ?? 0,
      ...boxes[i],
    })),
    edges: edges.map((edge, i) => {
      const laidEdge = routes.get(edge.id)
      const section = laidEdge?.sections?.[0]
      const route = section ? [section.startPoint, ...(section.bendPoints ?? []), section.endPoint] : []
      const pills: PlacedPill[] = []
      if (views[i].length) {
        const label = laidEdge?.labels?.[0]
        if (!label) throw new Error(`ELK returned no label for edge ${edge.id}`)
        const y = runY(route, label) - PILL_HEIGHT / 2
        let x = (label.x ?? 0) + 16
        for (const view of views[i]) {
          pills.push({ view, x, y })
          x += view.width + PILL_GAP
        }
      }
      return { edge, route, path: roundedPath(route), pills }
    }),
  }
}
