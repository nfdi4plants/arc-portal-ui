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

  it('gives the graph its name once, on the region', async () => {
    render(canvas())

    await screen.findByRole('button', { name: 'Alpha, select to open' })

    expect(screen.getAllByLabelText('Test graph')).toEqual([region()])
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

  it('names a node by its ariaLabel and pill texts, without the tooltip', async () => {
    const node: CanvasNode = {
      ...plainNode('a'),
      title: 'Alpha',
      ariaLabel: 'Alpha, select to open',
      tooltip: 'Alpha (study)',
      pills: [{ key: 'n1', kind: 'property', name: 'species', value: 'Talinum', category: 'characteristic' }],
    }
    render(canvas({ nodes: [node], edges: [] }))

    expect(await screen.findByRole('button', { name: 'Alpha, select to open, species: Talinum' })).toBeInTheDocument()
  })

  it('names a count pill by its tooltip in the label of its edge', async () => {
    const countEdge: CanvasEdge = {
      id: 'ab',
      from: 'a',
      to: 'b',
      color: 'neutral',
      pills: [{ key: 'count', kind: 'count', value: '6', tooltip: '6 shared inputs and outputs' }],
    }
    render(canvas({ nodes: nodes.slice(0, 2), edges: [countEdge] }))

    expect(
      await screen.findByRole('group', { name: 'From Alpha to Beta: 6 shared inputs and outputs' }),
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

  it('moves focus to the container after the first layout when focusOnMount is set', async () => {
    render(canvas({ focusOnMount: true }))
    expect(document.body).toHaveFocus()

    await screen.findByRole('button', { name: 'Alpha, select to open' })

    expect(region()).toHaveFocus()
  })

  it('moves focus to the container that shows the alert when the layout of a new view fails', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = render(canvas())
    await screen.findByRole('button', { name: 'Alpha, select to open' })
    vi.mocked(layoutGraph).mockRejectedValueOnce(new Error('elk failed'))

    rerender(canvas({ resetKey: 'two' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not lay out this graph.')
    expect(region()).toHaveFocus()
    expect(log).toHaveBeenCalled()
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

// The edge from Alpha to Beta needs a box of 543px to expand inline: its widest pill (143px), the 132px of the
// widest node on each side, 32px of label padding and 104px of ELK padding and spacing.
describe('GraphCanvas in a measured box', () => {
  // The client size is what a scrollbar leaves of the box. The border size is the whole box.
  let size = { width: 0, height: 0, borderWidth: 0, borderHeight: 0 }
  let notifyResize: Array<() => void> = []

  const sizeOf = (width: number, height: number, border?: { width: number; height: number }) => ({
    width,
    height,
    borderWidth: border?.width ?? width,
    borderHeight: border?.height ?? height,
  })

  function measureBox(width: number, height: number, border?: { width: number; height: number }) {
    size = sizeOf(width, height, border)
    notifyResize = []
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => size.width)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => size.height)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(() => size.borderWidth)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(() => size.borderHeight)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize.push(callback)
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  }

  async function resize(width: number, height: number, border?: { width: number; height: number }) {
    size = sizeOf(width, height, border)
    await act(async () => notifyResize.forEach((notify) => notify()))
  }

  const layoutCalls = () => vi.mocked(layoutGraph).mock.calls.length
  const dialog = () => screen.queryByRole('dialog', { name: 'More properties of Alpha to Beta' })
  const listTexts = (list: HTMLElement) => within(list).getAllByRole('listitem').map((item) => item.textContent)

  it('expands the edge inline in a box that is wide enough', async () => {
    measureBox(1200, 700)
    const user = userEvent.setup()
    render(canvas())

    await user.click(await showMore())

    expect(await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(vi.mocked(layoutGraph).mock.lastCall?.[4]).toEqual({ width: 1200, portrait: false })
  })

  it('opens a list of the hidden properties in a box that is too narrow, without a new layout', async () => {
    measureBox(500, 300)
    const user = userEvent.setup()
    render(canvas())
    const more = await showMore()
    const before = layoutCalls()

    await user.click(more)

    const list = await screen.findByRole('dialog', { name: 'More properties of Alpha to Beta' })
    expect(listTexts(list)).toEqual(['duration: 2 h', 'volume: 5 ml'])
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(more).toHaveAccessibleName('Show 2 more properties of Alpha to Beta')
    expect(more).toHaveTextContent('+2')
    expect(hiddenPill()).toBeNull()
    expect(layoutCalls()).toBe(before)
  })

  it('moves the focus into the list and back to the toggle on Escape', async () => {
    measureBox(500, 300)
    const user = userEvent.setup()
    render(canvas())
    const more = await showMore()
    more.focus()

    await user.keyboard('{Enter}')
    const list = await screen.findByRole('dialog', { name: 'More properties of Alpha to Beta' })
    expect(within(list).getByRole('list')).toHaveFocus()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(dialog()).toBeNull())
    expect(more).toHaveFocus()
    expect(more).toHaveAttribute('aria-expanded', 'false')
  })

  it.each([
    ['Tab', '{Tab}'],
    ['Shift+Tab', '{Shift>}{Tab}{/Shift}'],
  ])('closes the list on %s and puts the focus back on the toggle', async (_name, keys) => {
    measureBox(500, 300)
    const user = userEvent.setup()
    render(canvas())
    const more = await showMore()
    more.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog', { name: 'More properties of Alpha to Beta' })

    await user.keyboard(keys)

    await waitFor(() => expect(dialog()).toBeNull())
    expect(more).toHaveFocus()
    expect(more).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the list on a click outside and on a second click on the toggle', async () => {
    measureBox(500, 300)
    const user = userEvent.setup()
    render(canvas())
    const more = await showMore()

    await user.click(more)
    await screen.findByRole('dialog')
    await user.click(document.body)
    await waitFor(() => expect(dialog()).toBeNull())

    await user.click(more)
    await screen.findByRole('dialog')
    await user.click(more)
    await waitFor(() => expect(dialog()).toBeNull())
  })

  it('keeps one list open at a time', async () => {
    measureBox(300, 200)
    const user = userEvent.setup()
    const both = edges.map((e) => ({ ...e, morePills: [{ key: `${e.id}-more`, kind: 'count' as const, value: '9' }] }))
    render(canvas({ edges: both }))

    await user.click(await screen.findByRole('button', { name: 'Show 1 more properties of Alpha to Beta' }))
    await screen.findByRole('dialog', { name: 'More properties of Alpha to Beta' })
    await user.click(screen.getByRole('button', { name: 'Show 1 more properties of Beta to Gamma' }))

    expect(await screen.findByRole('dialog', { name: 'More properties of Beta to Gamma' })).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('relays out on a resize only while an edge is expanded', async () => {
    measureBox(1200, 700)
    const user = userEvent.setup()
    render(canvas())
    const more = await showMore()
    const collapsed = layoutCalls()

    await resize(1000, 700)
    await act(async () => {})
    expect(layoutCalls()).toBe(collapsed)

    await user.click(more)
    await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })
    const expanded = layoutCalls()

    await resize(1002, 702)
    await act(async () => {})
    expect(layoutCalls()).toBe(expanded)

    await resize(900, 700)
    await waitFor(() => expect(layoutCalls()).toBe(expanded + 1))
    expect(vi.mocked(layoutGraph).mock.lastCall?.[4]).toEqual({ width: 900, portrait: false })
  })

  it('draws an expanded edge collapsed while the box is too narrow and expands it again when the box grows', async () => {
    measureBox(1200, 700)
    const user = userEvent.setup()
    render(canvas())
    await user.click(await showMore())
    await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })

    await resize(400, 300)
    expect(await showMore()).toHaveAttribute('aria-expanded', 'false')
    await waitFor(() => expect(hiddenPill()).toBeNull())

    await resize(1200, 700)
    expect(await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })).toBeInTheDocument()
  })

  // The root fills the box. The toggle of the edge from Alpha to Beta is 18px high and sits anchorTop px below the top.
  function placeToggle(anchorTop: number) {
    const rect = (top: number, bottom: number, left = 0, right = 500) =>
      ({ top, bottom, left, right, x: left, y: top, width: right - left, height: bottom - top, toJSON() {} }) as DOMRect
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.getAttribute('role') === 'region') return rect(0, size.height)
      if (this.getAttribute('aria-label')?.startsWith('Show 2 more')) return rect(anchorTop, anchorTop + 18, 100, 160)
      if (this.getAttribute('class')?.includes('canvas')) return rect(0, 300)
      return rect(0, 0)
    })
  }

  it('opens the list below the toggle when there is more room below and limits its height to that room', async () => {
    measureBox(500, 300)
    placeToggle(40)
    const user = userEvent.setup()
    render(canvas())

    await user.click(await showMore())

    const list = await screen.findByRole('dialog')
    // 300 visible, minus the bottom of the toggle (58), the 4px gap and the 8px margin.
    expect(list.style.maxHeight).toBe('230px')
    expect(list.style.top).toBe('62px')
    expect(list.style.bottom).toBe('auto')
    expect(list.style.maxWidth).toBe('484px')
  })

  it('opens the list above the toggle when there is more room above', async () => {
    measureBox(500, 300)
    placeToggle(240)
    const user = userEvent.setup()
    render(canvas())

    await user.click(await showMore())

    const list = await screen.findByRole('dialog')
    // 240 above the toggle, minus the gap and the margin.
    expect(list.style.maxHeight).toBe('228px')
    expect(list.style.top).toBe('auto')
    expect(list.style.bottom).toBe('64px')
  })

  it('fits an open list to the new height of the box', async () => {
    measureBox(500, 300)
    placeToggle(40)
    const user = userEvent.setup()
    render(canvas())
    await user.click(await showMore())
    const list = await screen.findByRole('dialog')
    expect(list.style.maxHeight).toBe('230px')

    await resize(500, 200)

    expect(screen.getByRole('dialog')).toBe(list)
    expect(list.style.maxHeight).toBe('130px')
  })

  it('closes an open list when the box grows', async () => {
    measureBox(500, 300)
    const user = userEvent.setup()
    render(canvas())
    await user.click(await showMore())
    await screen.findByRole('dialog')

    await resize(900, 300)

    await waitFor(() => expect(dialog()).toBeNull())
    expect(await showMore()).toHaveAttribute('aria-expanded', 'false')
  })

  describe('in a portrait box', () => {
    it('shows one chip per edge with several pills, keeps a single pill and lists every pill on the chip', async () => {
      measureBox(358, 760)
      const user = userEvent.setup()
      render(canvas())

      const chip = await screen.findByRole('button', { name: 'Show the 3 details of Alpha to Beta' })
      expect(chip).toHaveTextContent('3')
      expect(screen.getByRole('img', { name: '3' })).toBeInTheDocument()
      expect(screen.queryByRole('img', { name: 'Parameter · temperature: 20 C' })).toBeNull()
      // A portrait box takes the compact layout, which does not depend on the width.
      expect(vi.mocked(layoutGraph).mock.lastCall?.[4]).toEqual({ width: 0, portrait: true })

      await user.click(chip)

      const list = await screen.findByRole('dialog', { name: 'Details of Alpha to Beta' })
      expect(listTexts(list)).toEqual(['temperature: 20 C', 'duration: 2 h', 'volume: 5 ml'])
      expect(chip).toHaveAttribute('aria-expanded', 'true')
    })

    it('uses the compact layout in a portrait box even when the normal layout would fit', async () => {
      measureBox(1200, 1500)
      render(canvas())

      expect(await screen.findByRole('button', { name: 'Show the 3 details of Alpha to Beta' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Show 2 more properties/ })).toBeNull()
    })

    it('keeps the normal layout in a landscape box even when the graph overflows it', async () => {
      measureBox(300, 200)
      render(canvas())

      expect(await showMore()).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Show the \d+ details/ })).toBeNull()
      expect(vi.mocked(layoutGraph).mock.lastCall?.[4]).toEqual({ width: 0, portrait: false })
    })

    it('does not lay out again when a portrait box changes its width', async () => {
      measureBox(358, 760)
      render(canvas())
      await screen.findByRole('button', { name: 'Show the 3 details of Alpha to Beta' })
      const before = layoutCalls()

      await resize(500, 760)
      await act(async () => {})

      expect(layoutCalls()).toBe(before)
    })

    it('starts the graph at the left edge of the box, where a normal graph is centered', async () => {
      measureBox(358, 760)
      const { unmount } = render(canvas())
      await screen.findByRole('button', { name: 'Show the 3 details of Alpha to Beta' })
      expect(region().querySelector('svg')?.parentElement?.className).toContain('canvasCompact')
      unmount()

      measureBox(1200, 700)
      render(canvas())
      await showMore()
      expect(region().querySelector('svg')?.parentElement?.className).not.toContain('canvasCompact')
    })

    it('keeps its mode when a scrollbar takes space off the client size of a box that is nearly square', async () => {
      // 740x745 is portrait. A horizontal scrollbar leaves 730 of the height, which is less than the width.
      measureBox(740, 745)
      render(canvas())
      await screen.findByRole('button', { name: 'Show the 3 details of Alpha to Beta' })
      const before = layoutCalls()

      await resize(740, 730, { width: 740, height: 745 })
      await act(async () => {})

      expect(screen.getByRole('button', { name: 'Show the 3 details of Alpha to Beta' })).toBeInTheDocument()
      expect(layoutCalls()).toBe(before)
    })

    it('stays in the normal layout when a scrollbar makes the client size of a landscape box portrait', async () => {
      // 740x735 is landscape. A vertical scrollbar leaves 725 of the width, which is less than the height.
      measureBox(740, 735)
      render(canvas())
      await showMore()
      const before = layoutCalls()

      await resize(725, 735, { width: 740, height: 735 })
      await act(async () => {})

      expect(await showMore()).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Show the \d+ details/ })).toBeNull()
      expect(layoutCalls()).toBe(before)
    })

    it('scrolls to a centered node only vertically', async () => {
      vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(5000)
      vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockReturnValue(5000)
      measureBox(200, 300)
      const target = (await layoutGraph(nodes, edges, new Set(), estimateTextWidth, { portrait: true })).nodes.find(
        (laid) => laid.node.id === 'c',
      )
      vi.mocked(layoutGraph).mockClear()

      render(canvas({ centerNodeId: 'c' }))
      await screen.findByRole('button', { name: 'Alpha, select to open' })

      expect(region().scrollLeft).toBe(0)
      expect(region().scrollTop).toBe((target?.y ?? 0) + (target?.height ?? 0) / 2 - 150)
    })
  })
})
