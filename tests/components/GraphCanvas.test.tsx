import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GraphCanvas } from '../../src/components/ArcDashboard/Provenance/GraphCanvas'
import { layoutGraph, type GraphLayout } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/layout'
import type * as LayoutModule from '../../src/components/ArcDashboard/Provenance/GraphCanvas/layout'
import { estimateTextWidth } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/pills'
import type { CanvasEdge, CanvasNode, GraphCanvasProps } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/types'

const LAYOUT_MODULE = '../../src/components/ArcDashboard/Provenance/GraphCanvas/layout'

// Most tests run the real ELK. A few replace one layout call with a promise they control.
vi.mock('../../src/components/ArcDashboard/Provenance/GraphCanvas/layout', async (importOriginal) => {
  const actual = await importOriginal<typeof LayoutModule>()
  return { ...actual, layoutGraph: vi.fn(actual.layoutGraph) }
})

const nodes: CanvasNode[] = [
  { id: 'a', title: 'Alpha', color: 'study', ariaLabel: 'Alpha, select to open' },
  { id: 'b', title: 'Beta', color: 'assay', ariaLabel: 'Beta, select to open' },
  { id: 'c', title: 'Gamma', color: 'neutral', ariaLabel: 'Gamma, fixed', clickable: false },
]

const edges: CanvasEdge[] = [
  {
    id: 'ab',
    from: 'a',
    to: 'b',
    color: 'study',
    pills: [{ key: 'p1', kind: 'property', name: 'temperature', value: '20 C', category: 'parameter' }],
    morePills: [
      { key: 'p2', kind: 'property', name: 'duration', value: '2 h', category: 'parameter' },
      { key: 'p3', kind: 'property', name: 'volume', value: '5 ml', category: 'parameter' },
    ],
  },
  { id: 'bc', from: 'b', to: 'c', color: 'neutral', pills: [{ key: 'count', kind: 'count', value: '3' }] },
]

const noop = () => {}

function canvas(props: Partial<GraphCanvasProps> = {}) {
  return <GraphCanvas nodes={nodes} edges={edges} ariaLabel="Test graph" onNodeClick={noop} resetKey="one" {...props} />
}

function plainNode(id: string): CanvasNode {
  return { id, title: id, color: 'study', ariaLabel: id }
}

async function realLayout(layoutNodes: CanvasNode[], layoutEdges: CanvasEdge[]): Promise<GraphLayout> {
  const actual = await vi.importActual<{ layoutGraph: typeof layoutGraph }>(LAYOUT_MODULE)
  return actual.layoutGraph(layoutNodes, layoutEdges, new Set(), estimateTextWidth)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const region = () => screen.getByRole('region', { name: 'Test graph' })
const showMore = () => screen.findByRole('button', { name: 'Show 2 more properties of Alpha to Beta' })
const hiddenPill = () => screen.queryByRole('img', { name: 'Parameter · duration: 2 h' })

describe('GraphCanvas', () => {
  it('renders a button for every clickable node once the layout is done', async () => {
    render(canvas())

    expect(await screen.findByRole('button', { name: 'Alpha, select to open' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Beta, select to open' })).toBeInTheDocument()
  })

  it('calls onNodeClick on click and on Enter', async () => {
    const onNodeClick = vi.fn()
    const user = userEvent.setup()
    render(canvas({ onNodeClick }))

    const alpha = await screen.findByRole('button', { name: 'Alpha, select to open' })
    await user.click(alpha)
    screen.getByRole('button', { name: 'Beta, select to open' }).focus()
    await user.keyboard('{Enter}')

    expect(onNodeClick.mock.calls).toEqual([['a'], ['b']])
  })

  it('renders a node with clickable false without button semantics', async () => {
    render(canvas())

    await screen.findByRole('button', { name: 'Alpha, select to open' })
    expect(screen.queryByRole('button', { name: 'Gamma, fixed' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Gamma, fixed' })).toBeInTheDocument()
  })

  it('renders no node as a button without an onNodeClick handler', async () => {
    render(canvas({ onNodeClick: undefined }))

    expect(await screen.findByRole('group', { name: 'Alpha, select to open' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alpha, select to open' })).toBeNull()
  })

  it('appends the pill texts and the tooltip to the label of a node', async () => {
    const node: CanvasNode = {
      ...plainNode('a'),
      ariaLabel: 'Alpha, select to open',
      tooltip: 'Alpha (study)',
      pills: [{ key: 'n1', kind: 'property', name: 'species', value: 'Talinum', category: 'characteristic' }],
    }
    render(canvas({ nodes: [node], edges: [] }))

    expect(
      await screen.findByRole('button', { name: 'Alpha, select to open, species: Talinum, Alpha (study)' }),
    ).toBeInTheDocument()
  })

  it('groups the pills of an edge under a label with both ends and the pill texts', async () => {
    const user = userEvent.setup()
    render(canvas())

    const collapsed = await screen.findByRole('group', { name: 'From Alpha to Beta: temperature: 20 C' })
    expect(within(collapsed).getByRole('img', { name: 'Parameter · temperature: 20 C' })).toBeInTheDocument()

    await user.click(await showMore())
    expect(
      await screen.findByRole('group', {
        name: 'From Alpha to Beta: temperature: 20 C, duration: 2 h, volume: 5 ml',
      }),
    ).toBeInTheDocument()
  })

  it('names the edge on the toggle and reports whether it is expanded', async () => {
    const user = userEvent.setup()
    render(canvas())

    const more = await showMore()
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await user.click(more)

    const fewer = await screen.findByRole('button', { name: 'Show fewer properties of Alpha to Beta' })
    expect(fewer).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the hidden pills behind "+2" and hides them again behind "−"', async () => {
    const user = userEvent.setup()
    render(canvas())

    await user.click(await showMore())
    expect(await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Parameter · volume: 5 ml' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show fewer properties of Alpha to Beta' }))
    await waitFor(() => expect(hiddenPill()).toBeNull())
    expect(await showMore()).toBeInTheDocument()
  })

  it('collapses expanded edges when resetKey changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(canvas())
    await user.click(await showMore())
    await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })

    rerender(canvas({ resetKey: 'two' }))

    expect(await showMore()).toBeInTheDocument()
    expect(hiddenPill()).toBeNull()
  })

  it('starts collapsed when it returns to a resetKey it left expanded', async () => {
    const user = userEvent.setup()
    const { rerender } = render(canvas({ resetKey: 'K1' }))
    await user.click(await showMore())
    await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })
    rerender(canvas({ resetKey: 'K2' }))
    await showMore()

    rerender(canvas({ resetKey: 'K1' }))

    expect(await showMore()).toBeInTheDocument()
    expect(hiddenPill()).toBeNull()
  })

  it('leaves focus alone on the first mount', async () => {
    render(canvas())

    await screen.findByRole('button', { name: 'Alpha, select to open' })

    expect(document.body).toHaveFocus()
  })

  it('moves focus to the container once the layout of a new view is drawn', async () => {
    const { rerender } = render(canvas())
    await screen.findByRole('button', { name: 'Alpha, select to open' })

    rerender(canvas({ resetKey: 'two' }))
    await screen.findByRole('button', { name: 'Alpha, select to open' })

    expect(region()).toHaveFocus()
  })

  it('scrolls back to the top left when the view changes', async () => {
    const { rerender } = render(canvas())
    await screen.findByRole('button', { name: 'Alpha, select to open' })
    region().scrollLeft = 40
    region().scrollTop = 25

    rerender(canvas({ resetKey: 'two' }))
    await screen.findByRole('button', { name: 'Alpha, select to open' })

    expect([region().scrollLeft, region().scrollTop]).toEqual([0, 0])
  })

  it('never draws the result of a layout from an earlier resetKey', async () => {
    const stale = deferred<GraphLayout>()
    const fresh = deferred<GraphLayout>()
    vi.mocked(layoutGraph).mockImplementationOnce(() => stale.promise).mockImplementationOnce(() => fresh.promise)
    const oldNodes = [plainNode('Old')]
    const newNodes = [plainNode('New')]
    const { rerender } = render(canvas({ nodes: oldNodes, edges: [], resetKey: 'one' }))
    rerender(canvas({ nodes: newNodes, edges: [], resetKey: 'two' }))

    const oldLayout = await realLayout(oldNodes, [])
    await act(async () => stale.resolve(oldLayout))
    expect(screen.queryByRole('button', { name: 'Old' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Laying out…')

    const newLayout = await realLayout(newNodes, [])
    await act(async () => fresh.resolve(newLayout))
    expect(await screen.findByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Old' })).toBeNull()
  })

  it('shows an alert and logs the error when the layout fails', async () => {
    const error = new Error('elk failed')
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(layoutGraph).mockRejectedValueOnce(error)
    render(canvas())

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not lay out this graph.')
    expect(log).toHaveBeenCalledWith(expect.any(String), error)
  })

  describe('centerNodeId', () => {
    function stubScrollBox(scrollWidth: number) {
      vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300)
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(200)
      vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(scrollWidth)
      vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(200)
    }

    async function centerOfGamma(): Promise<number> {
      const gamma = (await realLayout(nodes, edges)).nodes.find((laid) => laid.node.id === 'c')
      return (gamma?.x ?? 0) + (gamma?.width ?? 0) / 2
    }

    it('scrolls so that the node is in the middle of the container', async () => {
      stubScrollBox(5000)
      const center = await centerOfGamma()

      render(canvas({ centerNodeId: 'c' }))
      await screen.findByRole('button', { name: 'Alpha, select to open' })

      expect(region().scrollLeft).toBe(center - 150)
    })

    it('stays inside the scroll range', async () => {
      stubScrollBox(400)

      render(canvas({ centerNodeId: 'c' }))
      await screen.findByRole('button', { name: 'Alpha, select to open' })

      expect([region().scrollLeft, region().scrollTop]).toEqual([100, 0])
    })
  })
})
