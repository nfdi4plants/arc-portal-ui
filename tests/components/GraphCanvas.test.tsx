import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { GraphCanvas } from '../../src/components/ArcDashboard/Provenance/GraphCanvas'
import type { CanvasEdge, CanvasNode, GraphCanvasProps } from '../../src/components/ArcDashboard/Provenance/GraphCanvas/types'

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

function canvas(props: Partial<GraphCanvasProps> = {}) {
  return <GraphCanvas nodes={nodes} edges={edges} ariaLabel="Test graph" resetKey="one" {...props} />
}

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

  it('shows the hidden pills behind "+2" and hides them again behind "−"', async () => {
    const user = userEvent.setup()
    render(canvas())

    await user.click(await screen.findByRole('button', { name: 'Show 2 more properties' }))
    expect(await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Parameter · volume: 5 ml' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show fewer properties' }))
    await waitFor(() => expect(hiddenPill()).toBeNull())
    expect(screen.getByRole('button', { name: 'Show 2 more properties' })).toBeInTheDocument()
  })

  it('collapses expanded edges when resetKey changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(canvas())
    await user.click(await screen.findByRole('button', { name: 'Show 2 more properties' }))
    await screen.findByRole('img', { name: 'Parameter · duration: 2 h' })

    rerender(canvas({ resetKey: 'two' }))

    expect(await screen.findByRole('button', { name: 'Show 2 more properties' })).toBeInTheDocument()
    expect(hiddenPill()).toBeNull()
  })
})
