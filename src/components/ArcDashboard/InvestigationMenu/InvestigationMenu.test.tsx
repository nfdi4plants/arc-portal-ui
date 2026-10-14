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
      'Description', 'Contacts', 'Organizations', 'Publications (2)', 'Assays (3)', 'Studies (2)', 'Runs (6)', 'Workflows (6)',
    ])
    await user.click(screen.getByRole('menuitem', { name: 'Contacts' }))
    const popup = screen.getByRole('dialog', { name: 'Contacts' })
    expect(within(popup).getAllByRole('listitem')).toHaveLength(12)
    await user.click(within(popup).getByRole('button', { name: 'Shrink Contacts' }))
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
})
