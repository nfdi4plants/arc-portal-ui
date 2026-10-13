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
