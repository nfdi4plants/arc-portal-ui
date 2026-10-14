import { screen, within } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from '../../components/ArcDashboard/ArcDashboardFrame'
import story from './ScrollingDashboard.stories'
import { selectInvestigationMetadata } from '../../components/ArcDashboard/Investigation/selectInvestigationMetadata'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => {
  const [path, setPath] = useState('')
  const folders: Record<string, string[]> = {
    '': ['assays', 'studies', 'runs', 'workflows'],
    assays: ['GCqTOF_targets'], studies: ['TalinumGenomeDraft'], runs: ['deseq2'], workflows: ['deseq2'],
  }
  return <>
    <label>Search ARC files<input /></label>
    <nav aria-label="Breadcrumbs"><a href="#" onClick={() => setPath('')}>root</a></nav>
    <p>Current folder: {path || 'root'}</p>
    <table><tbody>{(folders[path] ?? []).map(folder => <tr key={folder}><td>
      <a href="#" onClick={() => setPath(path ? `${path}/${folder}` : folder)}><span title={folder}>{folder}</span></a>
    </td></tr>)}</tbody></table>
  </>
} }))

async function openDashboard() {
  const store = createArcStore(sampleCrateSource())
  await store.load()
  renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={story.args.content} label={story.args.label} arcJson={crateJson} /></ArcProvider>)
  await screen.findByRole('textbox', { name: 'Search ARC files' }, { timeout: 5000 })
  return selectInvestigationMetadata(store.getArc()!)
}

describe('ScrollingDashboard', () => {
  it('opens investigation entities beside the parent menu and supports returning with the keyboard', async () => {
    const metadata = await openDashboard()
    const user = userEvent.setup()
    const investigation = screen.getByRole('button', { name: 'Investigation' })
    await user.click(investigation)
    const parent = screen.getByRole('menu', { name: 'Investigation' })
    const categories = [
      ['Contacts', 12], ['Organizations', 4], ['Publications', 2],
      ['Assays', 3], ['Studies', 2], ['Runs', 6], ['Workflows', 6],
    ] as const
    for (const [name, count] of categories) {
      await user.click(within(parent).getByRole('menuitem', { name: `${name} (${count})` }))
      const submenu = await screen.findByRole('menu', { name: `${name} (${count})` })
      expect(parent).toBeVisible()
      expect(within(submenu).getAllByRole('menuitem')).toHaveLength(count)
      expect(screen.getAllByRole('menu')).toHaveLength(2)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      if (name === 'Contacts') expect(within(submenu).getAllByRole('menuitem').some(item => item.getAttribute('href')?.startsWith('https://orcid.org/'))).toBe(true)
      if (name === 'Publications') {
        expect(within(submenu).getAllByRole('menuitem')[0]).toHaveAttribute('href', metadata.publications[0].url)
        expect(submenu).toHaveTextContent(metadata.publications[0].authors!)
        expect(submenu).toHaveTextContent(metadata.publications[0].doi!)
      }
    }
    await user.click(within(parent).getByRole('menuitem', { name: 'Organizations (4)' }))
    await user.click(within(screen.getByRole('menu', { name: 'Organizations (4)' })).getAllByRole('menuitem')[0])
    await user.keyboard('{ArrowLeft}')
    expect(screen.queryByRole('menu', { name: 'Organizations (4)' })).not.toBeInTheDocument()
    expect(within(parent).getByRole('menuitem', { name: 'Organizations (4)' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    const organizations = await screen.findByRole('menu', { name: 'Organizations (4)' })
    expect(organizations).toBeVisible()
    await user.click(within(organizations).getAllByRole('menuitem')[0])
    await user.keyboard('{Escape}')
    expect(parent).toBeVisible()
    await user.click(within(parent).getByRole('menuitem', { name: 'Description' }))
    const description = await screen.findByRole('menu', { name: 'Description' })
    expect(description).toHaveTextContent(metadata.identifier)
    await user.click(within(description).getAllByRole('menuitem')[0])
    await user.keyboard('{Escape}{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(investigation).toHaveFocus()
  }, 15000)

  it('opens selected assay, study, run and workflow folders in Webview and closes both menus', async () => {
    const metadata = await openDashboard()
    const user = userEvent.setup()
    const webview = screen.getByRole('region', { name: 'Webview section' })
    webview.scrollIntoView = vi.fn()
    await user.type(screen.getByRole('textbox'), 'saved search')
    for (const [category, id] of [
      ['Assays', 'assays'], ['Studies', 'studies'], ['Runs', 'runs'], ['Workflows', 'workflows'], ['Assays', 'assays'], ['Assays', 'assays'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: 'Investigation' }))
      const title = `${category} (${metadata[id].length})`
      await user.click(screen.getByRole('menuitem', { name: title }))
      await user.click(within(screen.getByRole('menu', { name: title })).getByRole('menuitem', { name: metadata[id][0].name }))
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(await screen.findByText(`Current folder: ${id}/${metadata[id][0].identifier}`)).toBeVisible()
      expect(webview.scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'smooth' })
      expect(screen.getByRole('textbox')).toHaveValue('saved search')
    }
    expect(screen.getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
  }, 15000)

  it('jumps and moves focus between the viewers while preserving file input', async () => {
    await openDashboard()
    const user = userEvent.setup()
    expect(within(screen.getByRole('navigation', { name: 'Viewer navigation' })).getAllByRole('button').map(button => button.textContent))
      .toEqual(['Investigation', 'Jump to Graphview', 'Jump to Webview', 'Jump to ARCade'])
    const webview = screen.getByRole('region', { name: 'Webview section' })
    const graphview = screen.getByRole('region', { name: 'Graphview section' })
    expect(screen.getAllByRole('region', { name: /^(Graphview|Webview) section$/ }).map(section => section.getAttribute('aria-label')))
      .toEqual(['Graphview section', 'Webview section'])
    // jsdom has no scroll implementation; exercise the jump controls and their focus behavior.
    webview.scrollIntoView = vi.fn()
    graphview.scrollIntoView = vi.fn()
    await user.type(screen.getByRole('textbox'), 'assays')
    await user.click(screen.getByRole('button', { name: 'Jump to Graphview' }))
    expect(graphview.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(graphview).toHaveFocus()
    expect(within(graphview).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Jump to Webview' }))
    expect(webview.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(webview).toHaveFocus()
    expect(screen.getByRole('textbox')).toHaveValue('assays')
    expect(screen.getByRole('button', { name: 'Investigation' })).toBeVisible()
    expect(within(screen.getByRole('region', { name: 'ARCade section' })).getByRole('region', { name: 'ARCade' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump to ARCade' })).toBeVisible()
    const game = screen.getByRole('region', { name: 'ARCade section' })
    game.scrollIntoView = vi.fn()
    await user.click(screen.getByRole('button', { name: 'Jump to ARCade' }))
    expect(game.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
    expect(game).toHaveFocus()
    expect(screen.getByRole('textbox')).toHaveValue('assays')
  }, 15000)

  it('expands each viewer and restores it with its contents intact', async () => {
    await openDashboard()
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox'), 'studies')
    await user.click(screen.getByRole('button', { name: 'Expand Webview' }))
    expect(within(screen.getByRole('dialog', { name: 'Webview' })).getByRole('textbox')).toHaveValue('studies')
    await user.click(screen.getByRole('button', { name: 'Shrink Webview' }))
    await user.click(screen.getByRole('button', { name: 'Expand Graphview' }))
    expect(within(screen.getByRole('dialog', { name: 'Graphview' })).getByRole('region', { name: 'Provenance explorer' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Shrink Graphview' }))
    expect(screen.getByRole('textbox')).toHaveValue('studies')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  }, 15000)
})
