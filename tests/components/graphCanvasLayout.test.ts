import { describe, expect, it } from 'vitest'
import { layoutGraph, type GraphLayout } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/layout'
import { estimateTextWidth } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/pills'
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
    const collapsed = await layoutGraph(nodes, edges, new Set(), measure)
    const expanded = await layoutGraph(nodes, edges, new Set(['bc']), measure)

    const [ab, bc, cd] = gaps(collapsed)
    const [abExpanded, bcExpanded, cdExpanded] = gaps(expanded)
    expect(bcExpanded).toBeGreaterThan(bc)
    expect(abExpanded).toBe(ab)
    expect(cdExpanded).toBe(cd)
  })

  it('keeps every node on its row and layer while one edge of disconnected components expands', async () => {
    const xOf = (layout: GraphLayout, ids: string[]) => [...new Set(layout.nodes.filter(({ node }) => ids.includes(node.id)).map(({ x }) => x))]
    const base = await layoutGraph(fanNodes, fanEdges, new Set(), measure)
    expect(xOf(base, fanSources)).toHaveLength(1)
    expect(xOf(base, fanTargets)).toHaveLength(1)

    for (const { id } of fanEdges) {
      const expanded = await layoutGraph(fanNodes, fanEdges, new Set([id]), measure)

      expect(expanded.nodes.map(({ y }) => y)).toEqual(base.nodes.map(({ y }) => y))
      expect(xOf(expanded, fanSources)).toEqual(xOf(base, fanSources))
      expect(xOf(expanded, fanTargets)).toHaveLength(1)
      expect(xOf(expanded, fanTargets)[0]).toBeGreaterThan(xOf(base, fanTargets)[0])
    }
  })

  it('places the pill run on the horizontal segment of its edge', async () => {
    const layout = await layoutGraph(nodes, edges, new Set(['bc']), measure)

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
