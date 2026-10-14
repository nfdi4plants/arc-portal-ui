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
    expect(screen.getAllByRole('menuitem')).toHaveLength(6)
    await user.click(screen.getByRole('menuitem', { name: 'Contacts' }))
    const popup = screen.getByRole('dialog', { name: 'Contacts' })
    expect(within(popup).getAllByRole('listitem')).toHaveLength(12)
    await user.click(within(popup).getByRole('button', { name: 'Shrink Contacts' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(investigation).toHaveFocus()
    await user.click(investigation)
    await user.click(screen.getByRole('menuitem', { name: 'Studies' }))
    expect(screen.getByRole('dialog', { name: 'Studies' })).toBeVisible()
  }, 15000)
})
