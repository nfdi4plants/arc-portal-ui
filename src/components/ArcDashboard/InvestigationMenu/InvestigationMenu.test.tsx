import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../../test/nativeDialog'
import { crateJson, sampleCrateSource } from '../../../../tests/helpers/sampleCrate'
import { createArcStore } from '../../../arc/arcStore'
import { renderWithTheme } from '../../../test/helpers'
import { DashboardWindow } from '../../DashboardWindow'
import { selectInvestigationMetadata } from '../Investigation/selectInvestigationMetadata'
import { InvestigationMenu } from './InvestigationMenu'

describe('InvestigationMenu', () => {
  it('opens investigation popup dashlets and returns focus to its trigger', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const metadata = selectInvestigationMetadata(store.getArc()!)
    renderWithTheme(<DashboardWindow><InvestigationMenu metadata={metadata} arcJson={crateJson} /></DashboardWindow>)
    const user = userEvent.setup()
    const investigation = screen.getByRole('button', { name: 'Investigation' })
    await user.click(investigation)
    expect(screen.getAllByRole('menuitem')).toHaveLength(8)
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Description', 'Contacts (12)', 'Organizations (4)', 'Publications (2)', 'Assays (3)', 'Studies (2)', 'Runs (6)', 'Workflows (6)',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Contacts (12)' }))
    const popup = screen.getByRole('dialog', { name: 'Contacts (12)' })
    expect(within(popup).getAllByRole('listitem')).toHaveLength(12)
    await user.click(within(popup).getByRole('button', { name: 'Shrink Contacts (12)' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(investigation).toHaveFocus()
    for (const [name, count] of [['Studies', 2], ['Runs', 6], ['Workflows', 6]] as const) {
      await user.click(investigation)
      await user.click(screen.getByRole('menuitem', { name: `${name} (${count})` }))
      const details = screen.getByRole('dialog', { name: `${name} (${count})` })
      expect(within(details).getAllByRole('listitem')).toHaveLength(count)
      await user.click(within(details).getByRole('button', { name: `Shrink ${name} (${count})` }))
      expect(investigation).toHaveFocus()
    }
  }, 15000)

  it('shows category counts as right-aligned counter badges in submenu presentation', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const metadata = selectInvestigationMetadata(store.getArc()!)
    renderWithTheme(<DashboardWindow><InvestigationMenu metadata={metadata} arcJson={crateJson} presentation="submenu" /></DashboardWindow>)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Investigation' }))
    const items = screen.getAllByRole('menuitem')
    expect(items).toHaveLength(8)
    expect(items[0].querySelector('[data-component="CounterLabel"]')).toBeNull()
    expect(items[0].querySelector('[data-component="ActionList.TrailingVisual"] svg')).not.toBeNull()
    for (const [index, name, count] of [[1, 'Contacts', 12], [4, 'Assays', 3], [5, 'Studies', 2], [6, 'Runs', 6]] as const) {
      expect(items[index]).toHaveTextContent(name)
      const badge = items[index].querySelector('[data-component="CounterLabel"]') as HTMLElement
      expect(badge).not.toBeNull()
      expect(badge).toHaveTextContent(String(count))
      expect(badge.closest('.investigation-category-label')).not.toBeNull()
      expect(badge.closest('[data-component="ActionList.TrailingVisual"]')).toBeNull()
      expect(items[index].querySelector('[data-component="ActionList.TrailingVisual"] svg')).not.toBeNull()
    }
  })
})
