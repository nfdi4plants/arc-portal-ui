import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '@primer/react'
import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderWithTheme } from '../../test/helpers'
import ArcViewer from '../ArcDashboard/ArcViewer/ArcViewer'
import { PopupDashlet } from './PopupDashlet'

// Model the viewer's desktop pane and its real Primer portal on smaller screens.
vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const desktop = window.matchMedia('(min-width: 1400px)').matches
  return (
    <div>
      <div data-is-hidden={!sidebarOpen || !desktop}>
        <div data-component="SplitPageLayout.Pane" hidden={!sidebarOpen || !desktop}>
          {desktop && <p>ARC files tree</p>}
        </div>
      </div>
      <button aria-label="Expand sidebar" onClick={() => setSidebarOpen(value => !value)}>Sidebar</button>
      {sidebarOpen && !desktop && <Dialog title="Files sidebar" onClose={() => setSidebarOpen(false)}><p>ARC files tree</p></Dialog>}
    </div>
  )
} }))

// jsdom has no native dialog methods. Browser checks cover its modal layer and backdrop.
const methods = ['showModal', 'show', 'close'] as const
const originalMethods = methods.map(method => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, method))
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; this.querySelector('button')?.focus() } },
    show: { configurable: true, value() { this.open = true } },
    close: { configurable: true, value() { this.open = false } },
  })
})
afterAll(() => {
  methods.forEach((method, index) => {
    const original = originalMethods[index]
    if (original) Object.defineProperty(HTMLDialogElement.prototype, method, original)
    else delete (HTMLDialogElement.prototype as unknown as Record<string, unknown>)[method]
  })
})

describe('PopupDashlet', () => {
  it('expands a clicked preview and preserves content when shrunk and reopened', async () => {
    const user = userEvent.setup()
    renderWithTheme(
      <PopupDashlet title="Webview" description="Browse ARC files." label="Webview dashlet">
        <p>ARC files preview</p>
        <label>Filter files<input /></label>
      </PopupDashlet>,
    )

    await user.click(screen.getByText('ARC files preview'))
    const popup = screen.getByRole('dialog', { name: 'Webview' })
    expect(popup).toHaveAttribute('aria-modal', 'true')
    expect(within(popup).queryByRole('heading', { name: 'Webview' })).not.toBeInTheDocument()
    await user.type(within(popup).getByRole('textbox', { name: 'Filter files' }), 'assays')
    await user.click(within(popup).getByRole('button', { name: 'Shrink Webview' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Webview dashlet' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Webview' })).toBeVisible()
    const expand = screen.getByRole('button', { name: 'Expand Webview' })
    expect(expand).toHaveFocus()
    await user.click(expand)
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByRole('textbox')).toHaveValue('assays')
  })

  it('supports opening and shrinking a dashlet with the keyboard', async () => {
    const user = userEvent.setup()
    renderWithTheme(<PopupDashlet title="Studies" description="ARC studies."><p>Study list</p></PopupDashlet>)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Expand Studies' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Studies' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Shrink Studies' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand Studies' })).toHaveFocus()
  })

  it('keeps a headerless graph interactive and preserves its selection through expansion', async () => {
    const user = userEvent.setup()
    function GraphPreview() {
      const [dataset, setDataset] = useState('All datasets')
      return <><button onClick={() => setDataset('Selected study')}>Open study</button><p>{dataset}</p></>
    }
    renderWithTheme(
      <PopupDashlet title="Graphview" description="Explore provenance." showHeader={false} expandOnClick={false}>
        <GraphPreview />
      </PopupDashlet>,
    )
    expect(screen.queryByRole('heading', { name: 'Graphview' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open study' }))
    expect(screen.getByText('Selected study')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand Graphview' }))
    const popup = screen.getByRole('dialog', { name: 'Graphview' })
    expect(within(popup).getByText('Selected study')).toBeVisible()
    await user.click(within(popup).getByRole('button', { name: 'Shrink Graphview' }))
    expect(screen.getByText('Selected study')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Graphview' })).not.toBeInTheDocument()
  })

  it.each([{ desktop: true, name: 'desktop pane' }, { desktop: false, name: 'mobile dialog' }])(
    'keeps the Webview $name in the popup and closes it when the popup shrinks', async ({ desktop }) => {
      const user = userEvent.setup()
      const matchMedia = window.matchMedia
      vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
        ...matchMedia(query), matches: desktop && query === '(min-width: 1400px)',
      }))
      renderWithTheme(
        <PopupDashlet title="Webview" description="Browse ARC files.">
          <ArcViewer jsonString="{}" embedded />
        </PopupDashlet>,
      )
      expect(screen.queryByRole('dialog', { name: 'Files sidebar' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
      const popup = screen.getByRole('dialog', { name: 'Webview' })
      if (!desktop) {
        await user.click(within(popup).getByRole('button', { name: 'Expand sidebar' }))
        const sidebar = screen.getByRole('dialog', { name: 'Files sidebar' })
        expect(sidebar.closest('.popup-dashlet-panel')).toBe(popup)
      }
      expect(await within(popup).findByText('ARC files tree')).toBeVisible()
      await user.click(within(popup).getByRole('button', { name: 'Shrink Webview' }))
      expect(screen.queryByRole('dialog', { name: 'Files sidebar' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expand Webview' })).toBeVisible()

      await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
      if (!desktop) expect(screen.queryByRole('dialog', { name: 'Files sidebar' })).not.toBeInTheDocument()
      else expect(await screen.findByText('ARC files tree')).toBeVisible()
    },
  )
})
