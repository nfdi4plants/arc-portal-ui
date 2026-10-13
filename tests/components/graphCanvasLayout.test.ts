import { describe, expect, it } from 'vitest'
import {
  layoutGraph,
  type GraphLayout,
  type LaidOutEdge,
  type PlacedPill,
} from '../../src/components/ArcDashboard/Provenance/GraphCanvas/layout'
import {
  edgePillViews,
  estimateTextWidth,
  PILL_GAP,
  PILL_HEIGHT,
  pillBlock,
} from '../../src/components/ArcDashboard/Provenance/GraphCanvas/pills'
import type { CanvasEdge, CanvasNode, CanvasPill } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/types'

const measure = (text: string) => estimateTextWidth(text)

function node(id: string): CanvasNode {
  return { id, title: id, color: 'study', ariaLabel: id }
}

function property(key: string, name: string, value: string): CanvasPill {
  return { key, kind: 'property', name, value, category: 'parameter' }
}

function edge(id: string, from: string, to: string, pills: CanvasPill[], morePills: CanvasPill[] = []): CanvasEdge {
  return { id, from, to, color: 'study', pills, morePills }
}

// A chain a > b > c > d. The middle edge hides two pills.
const nodes = ['a', 'b', 'c', 'd'].map(node)
const edges = [
  edge('ab', 'a', 'b', [property('p1', 'temperature', '20 C'), property('p2', 'light', 'dark')]),
  edge('bc', 'b', 'c', [property('p3', 'duration', '2 h')], [property('p4', 'volume', '5 ml'), property('p5', 'pH', '7')]),
  edge('cd', 'c', 'd', [property('p6', 'instrument', 'GC-MS')]),
]

// A box so wide that an expanded edge keeps all its pills in one row.
const WIDE = { width: 3000 }

function gaps(layout: GraphLayout): number[] {
  return layout.nodes.slice(1).map((next, i) => next.x - (layout.nodes[i].x + layout.nodes[i].width))
}

// Three disconnected components: A has 4 targets, B has 2 and C has 2. Every edge hides two pills.
const fanSources = ['A', 'B', 'C']
const fanTargets = ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']
const fanNodes = [...fanSources, ...fanTargets].map(node)
const fanEdges = fanTargets.map((target, i) =>
  edge(`e${i}`, fanSources[i < 4 ? 0 : i < 6 ? 1 : 2], target, [property('p1', 'temperature', '20 C')], [
    property('p2', 'duration', '2 h'),
    property('p3', 'volume', '5 ml'),
  ]),
)

describe('layoutGraph', () => {
  it('widens only the gap of an expanded edge', async () => {
    const collapsed = await layoutGraph(nodes, edges, new Set(), measure, WIDE)
    const expanded = await layoutGraph(nodes, edges, new Set(['bc']), measure, WIDE)

    const [ab, bc, cd] = gaps(collapsed)
    const [abExpanded, bcExpanded, cdExpanded] = gaps(expanded)
    expect(bcExpanded).toBeGreaterThan(bc)
    expect(abExpanded).toBe(ab)
    expect(cdExpanded).toBe(cd)
  })

  it('keeps every node on its row and layer while one edge of disconnected components expands', async () => {
    const xOf = (layout: GraphLayout, ids: string[]) => [...new Set(layout.nodes.filter(({ node }) => ids.includes(node.id)).map(({ x }) => x))]
    const base = await layoutGraph(fanNodes, fanEdges, new Set(), measure, WIDE)
    expect(xOf(base, fanSources)).toHaveLength(1)
    expect(xOf(base, fanTargets)).toHaveLength(1)

    for (const { id } of fanEdges) {
      const expanded = await layoutGraph(fanNodes, fanEdges, new Set([id]), measure, WIDE)

      expect(expanded.nodes.map(({ y }) => y)).toEqual(base.nodes.map(({ y }) => y))
      expect(xOf(expanded, fanSources)).toEqual(xOf(base, fanSources))
      expect(xOf(expanded, fanTargets)).toHaveLength(1)
      expect(xOf(expanded, fanTargets)[0]).toBeGreaterThan(xOf(base, fanTargets)[0])
    }
  })

  it('places the pill run on the horizontal segment of its edge', async () => {
    const layout = await layoutGraph(nodes, edges, new Set(['bc']), measure, WIDE)

    for (const laidOut of layout.edges) {
      const first = laidOut.pills[0]
      const last = laidOut.pills[laidOut.pills.length - 1]
      const left = first.x - 16
      const right = last.x + last.view.width + 16
      const segments = laidOut.route.slice(1).flatMap((end, i) => {
        const start = laidOut.route[i]
        return Math.abs(start.y - end.y) < 0.5 ? [{ y: start.y, from: Math.min(start.x, end.x), to: Math.max(start.x, end.x) }] : []
      })
      const under = segments.find((segment) => segment.from <= left + 1 && segment.to >= right - 1)
      expect(under).toBeDefined()
      expect(Math.abs(first.y + 9 - (under?.y ?? Infinity))).toBeLessThanOrEqual(1)
    }
  })
})

// Two layers like the groups and detail views: four sources, five targets, six edges. The edge e3 hides ten pills.
function titled(id: string, title: string): CanvasNode {
  return { id, title, color: 'study', ariaLabel: id }
}

function many(prefix: string, count: number): CanvasPill[] {
  return Array.from({ length: count }, (_, i) => property(`${prefix}${i}`, `property ${i}`, `value ${i}`))
}

const SOURCES = ['s0', 's1', 's2', 's3']
const TARGETS = ['t0', 't1', 't2', 't3', 't4']
const layerNodes = [
  titled('s0', 'Input group of the study'),
  titled('s1', 'Inputs B'),
  titled('s2', 'Inputs C'),
  titled('s3', 'Inputs D'),
  titled('t0', 'Outputs A'),
  titled('t1', 'Outputs B with a long name'),
  titled('t2', 'Outputs C'),
  titled('t3', 'Outputs D'),
  titled('t4', 'Outputs E'),
]
const layerEdges = [
  edge('e0', 's0', 't0', many('a', 2), many('b', 3)),
  edge('e1', 's0', 't1', many('c', 1), many('d', 2)),
  edge('e2', 's1', 't1', many('e', 2), many('f', 2)),
  edge('e3', 's1', 't2', many('g', 2), many('h', 10)),
  edge('e4', 's2', 't3', many('i', 1), many('j', 2)),
  edge('e5', 's3', 't4', [{ key: 'count', kind: 'count', value: '6', tooltip: '6 shared nodes' }]),
]
const widestPill = Math.max(...edgePillViews(layerEdges[3], true, measure).map((view) => view.width))

const edgeOf = (layout: GraphLayout, id: string) => layout.edges.find(({ edge: e }) => e.id === id) as LaidOutEdge
const nodeOf = (layout: GraphLayout, id: string) => layout.nodes.find(({ node: n }) => n.id === id)!

interface Box {
  x: number
  y: number
  width: number
  height: number
}

const pillBox = ({ x, y, view }: PlacedPill): Box => ({ x, y, width: view.width, height: PILL_HEIGHT })
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

function rowsOf(pills: PlacedPill[]): PlacedPill[][] {
  const rows = new Map<number, PlacedPill[]>()
  for (const pill of pills) rows.set(pill.y, [...(rows.get(pill.y) ?? []), pill])
  return [...rows.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)
}

const rowSpan = (row: PlacedPill[]) => row[row.length - 1].x + row[row.length - 1].view.width - row[0].x

// Which node ids share an x, left to right.
function layers(layout: GraphLayout): string[][] {
  const byX = new Map<number, string[]>()
  for (const { node: n, x } of layout.nodes) byX.set(x, [...(byX.get(x) ?? []), n.id])
  return [...byX.entries()].sort(([a], [b]) => a - b).map(([, ids]) => ids)
}

// y of the route segment that carries the first row of pills, with the 16px of padding on both sides.
function lineUnder(laid: LaidOutEdge): number | undefined {
  const first = rowsOf(laid.pills)[0]
  const left = first[0].x - 16
  const right = first[first.length - 1].x + first[first.length - 1].view.width + 16
  return laid.route
    .slice(1)
    .flatMap((end, i) => {
      const start = laid.route[i]
      return Math.abs(start.y - end.y) < 0.5 && Math.min(start.x, end.x) <= left + 1 && Math.max(start.x, end.x) >= right - 1
        ? [start.y]
        : []
    })
    .at(0)
}

describe('layoutGraph with an expanded edge in a box', () => {
  it.each([1400, 1000])('wraps the pills into rows that keep the graph inside a box of %ipx', async (width) => {
    const collapsed = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width })
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width })
    const pills = edgeOf(expanded, 'e3').pills
    const rows = rowsOf(pills)

    expect(rows.length).toBeGreaterThan(1)
    expect(pills.map(({ view }) => view.key)).toEqual(edgePillViews(layerEdges[3], true, measure).map(({ key }) => key))
    // Every row sits between the layers, left-aligned with the first one, PILL_GAP below the row before.
    const sourcesRight = Math.max(...SOURCES.map((id) => nodeOf(expanded, id).x + nodeOf(expanded, id).width))
    const targetsLeft = nodeOf(expanded, 't0').x
    rows.forEach((row, r) => {
      expect(row[0].x).toBe(rows[0][0].x)
      expect(row[0].y).toBe(rows[0][0].y + r * (PILL_HEIGHT + PILL_GAP))
      expect(row[0].x).toBeGreaterThanOrEqual(sourcesRight)
      expect(row[0].x + rowSpan(row)).toBeLessThanOrEqual(targetsLeft)
    })
    // The "−" toggle ends the last row.
    const last = pills[pills.length - 1]
    expect(last.view.toggle).toBe('less')
    expect(rows[rows.length - 1].at(-1)).toBe(last)
    // The graph stays inside the box. The one-line run would be wider than the box alone.
    expect(collapsed.width).toBeLessThanOrEqual(width)
    expect(expanded.width).toBeLessThanOrEqual(width)
    expect(pillBlock(edgePillViews(layerEdges[3], true, measure)).width).toBeGreaterThan(width)
  })

  it('puts one pill in a row when the box leaves room for little more than the widest pill', async () => {
    const collapsed = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: 800 })
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width: 800 })
    const rows = rowsOf(edgeOf(expanded, 'e3').pills)

    // Only the small "−" toggle fits next to a pill, at the end of the last row.
    expect(rows.slice(0, -1).map((row) => row.length)).toEqual(Array(rows.length - 1).fill(1))
    expect(rows).toHaveLength(edgeOf(expanded, 'e3').pills.length - 1)
    // The collapsed runs of the other edges are wider than this box already, so the graph does not grow.
    expect(expanded.width).toBeLessThanOrEqual(collapsed.width)
  })

  it('puts the first row on the edge line like a collapsed run', async () => {
    const collapsed = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: 1400 })
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width: 1400 })

    for (const layout of [collapsed, expanded]) {
      const laid = edgeOf(layout, 'e3')
      expect(Math.abs(laid.pills[0].y + PILL_HEIGHT / 2 - (lineUnder(laid) ?? Infinity))).toBeLessThanOrEqual(1)
    }
  })

  it('keeps every node on its layer and the other pills inside the box', async () => {
    const collapsed = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: 1400 })

    for (const { id } of layerEdges.filter((e) => e.morePills?.length)) {
      const expanded = await layoutGraph(layerNodes, layerEdges, new Set([id]), measure, { width: 1400 })

      expect(layers(expanded)).toEqual(layers(collapsed))
      for (const laid of expanded.edges.filter(({ edge: other }) => other.id !== id)) {
        for (const pill of laid.pills) expect(pill.x + pill.view.width).toBeLessThanOrEqual(expanded.width)
      }
    }
  })

  it('moves the pills of the other edges by at most half of the growth of the gap', async () => {
    const collapsed = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: 1400 })
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width: 1400 })
    const growth = expanded.width - collapsed.width

    expect(growth).toBeGreaterThan(0)
    for (const laid of expanded.edges.filter(({ edge: e }) => e.id !== 'e3')) {
      laid.pills.forEach((pill, i) => {
        const before = edgeOf(collapsed, laid.edge.id).pills[i]
        expect(pill.x - before.x).toBeGreaterThanOrEqual(-1)
        expect(pill.x - before.x).toBeLessThanOrEqual(growth / 2 + 1)
      })
    }
  })

  it('reserves the space of the whole block', async () => {
    for (const width of [1400, 800]) {
      const layout = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width })
      const block = edgeOf(layout, 'e3').pills.map(pillBox)

      for (const { x, y, width: w, height } of layout.nodes) {
        for (const box of block) expect(overlaps(box, { x, y, width: w, height })).toBe(false)
      }
      for (const laid of layout.edges.filter(({ edge: e }) => e.id !== 'e3')) {
        for (const box of block) {
          for (const other of laid.pills) expect(overlaps(box, pillBox(other))).toBe(false)
          // No other route crosses the block either.
          laid.route.slice(1).forEach((end, i) => {
            const start = laid.route[i]
            const segment = {
              x: Math.min(start.x, end.x),
              y: Math.min(start.y, end.y),
              width: Math.abs(start.x - end.x) || 0.1,
              height: Math.abs(start.y - end.y) || 0.1,
            }
            expect(overlaps(box, segment)).toBe(false)
          })
        }
      }
    }
  })

  it('leaves an edge collapsed when its widest pill does not fit next to the nodes', async () => {
    const collapsed = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: 600 })
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width: 600 })
    const side = (ids: string[]) => Math.max(...ids.map((id) => nodeOf(collapsed, id).width))

    // The widest nodes of both sides, the label padding, ELK's padding and the 40px on both sides of the label.
    expect(edgeOf(collapsed, 'e3').minInlineWidth).toBe(side(SOURCES) + side(TARGETS) + 2 * 16 + 2 * 12 + 2 * 40 + widestPill)
    expect(edgeOf(collapsed, 'e3').minInlineWidth).toBeGreaterThan(600)
    expect(expanded.edges.map(({ pills }) => pills.map((p) => [p.view.key, p.x, p.y]))).toEqual(
      collapsed.edges.map(({ pills }) => pills.map((p) => [p.view.key, p.x, p.y])),
    )
  })

  it('wraps at the widest pill while the width is unknown', async () => {
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure)
    const rows = rowsOf(edgeOf(expanded, 'e3').pills)

    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) expect(rowSpan(row)).toBeLessThanOrEqual(widestPill)
  })
})

describe('layoutGraph in a portrait box', () => {
  it('lays out top to bottom in a portrait box, even when the normal layout would fit', async () => {
    const normal = await layoutGraph(layerNodes, layerEdges, new Set(), measure)
    const layout = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: normal.width + 500, portrait: true })

    expect(normal.compact).toBe(false)
    expect(layout.compact).toBe(true)
    for (const source of SOURCES) {
      for (const target of TARGETS) {
        expect(nodeOf(layout, target).y).toBeGreaterThan(nodeOf(layout, source).y + nodeOf(layout, source).height)
      }
    }
  })

  it('keeps the normal layout, left to right, in a landscape box even when the graph overflows it, and in an unmeasured box', async () => {
    for (const box of [{ width: 400 }, { width: 400, portrait: false }, { width: 0 }, {}]) {
      const layout = await layoutGraph(layerNodes, layerEdges, new Set(), measure, box)

      expect(layout.compact).toBe(false)
      expect(nodeOf(layout, 't0').x).toBeGreaterThan(nodeOf(layout, 's0').x + nodeOf(layout, 's0').width)
    }
  })

  it('does not depend on the width and ignores an expanded edge', async () => {
    const plain = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { portrait: true })
    const expanded = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width: 300, portrait: true })

    expect(expanded.compact).toBe(true)
    expect(expanded.nodes.map(({ x, y }) => [x, y])).toEqual(plain.nodes.map(({ x, y }) => [x, y]))
    expect(edgeOf(expanded, 'e3').pills).toHaveLength(1)
  })

  // A parent with four children, each with a chain below. The first chain is the longest.
  const FAN = [5, 3, 3, 2]
  const fanNodes = [titled('P', 'Parent'), ...FAN.flatMap((length, i) => Array.from({ length }, (_, j) => titled(`c${i}_${j}`, `child ${i}.${j}`)))]
  const fanEdges = FAN.flatMap((length, i) =>
    Array.from({ length }, (_, j) => edge(`f${i}_${j}`, j === 0 ? 'P' : `c${i}_${j - 1}`, `c${i}_${j}`, [{ key: `n${i}_${j}`, kind: 'count', value: '1' }])),
  )

  it('keeps the parent and the longest chain at the left of their layers, and the graph at the left edge', async () => {
    const layout = await layoutGraph(fanNodes, fanEdges, new Set(), measure, { portrait: true })
    const layerOf = (id: string) => layout.nodes.filter(({ y }) => y === nodeOf(layout, id).y)
    const chain = ['c0_0', 'c0_1', 'c0_2', 'c0_3', 'c0_4']

    expect(layout.compact).toBe(true)
    for (const id of ['P', ...chain]) {
      expect(nodeOf(layout, id).x).toBe(Math.min(...layerOf(id).map(({ x }) => x)))
    }
    // The other children fan out to the right of the first one, in the order of the edges.
    const firstChildren = ['c0_0', 'c1_0', 'c2_0', 'c3_0'].map((id) => nodeOf(layout, id).x)
    expect(firstChildren).toEqual([...firstChildren].sort((a, b) => a - b))
    expect(new Set(firstChildren).size).toBe(4)
    // ELK pads the graph by 12px, so the first column starts there.
    expect(Math.min(...layout.nodes.map(({ x }) => x))).toBe(12)
    expect(nodeOf(layout, 'c0_0').x).toBe(12)
  })

  it('shows one chip on every edge with several pills and keeps a single pill', async () => {
    const layout = await layoutGraph(layerNodes, layerEdges, new Set(['e3']), measure, { width: 400, portrait: true })

    for (const laid of layout.edges.filter(({ edge: e }) => e.id !== 'e5')) {
      const total = laid.edge.pills.length + (laid.edge.morePills?.length ?? 0)
      expect(laid.pills).toHaveLength(1)
      expect(laid.pills[0].view.toggle).toBe('more')
      expect(laid.pills[0].view.valuePart).toBe(`${total}`)
      expect(laid.pills[0].view.tooltip).toBe(`Show the ${total} properties`)
      expect(laid.pills[0].view.category).toBe('parameter')
    }
    const single = edgeOf(layout, 'e5').pills
    expect(single).toHaveLength(1)
    expect(single[0].view.kind).toBe('count')
    expect(single[0].view.toggle).toBeUndefined()
  })

  it('puts every chip on a vertical segment of its edge', async () => {
    const layout = await layoutGraph(layerNodes, layerEdges, new Set(), measure, { width: 400, portrait: true })

    for (const laid of layout.edges) {
      const pill = laid.pills[0]
      const middle = pill.x + pill.view.width / 2
      const segments = laid.route.slice(1).flatMap((end, i) => {
        const start = laid.route[i]
        return Math.abs(start.x - end.x) < 0.5 ? [{ x: start.x, top: Math.min(start.y, end.y), bottom: Math.max(start.y, end.y) }] : []
      })
      expect(
        segments.some((s) => Math.abs(s.x - middle) <= 1 && s.top <= pill.y + 1 && s.bottom >= pill.y + PILL_HEIGHT - 1),
      ).toBe(true)
    }
  })
})
