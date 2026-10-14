import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { crateJson, sampleCrateSource } from '../../../tests/helpers/sampleCrate'
import { ArcProvider } from '../../arc/ArcProvider'
import { createArcStore } from '../../arc/arcStore'
import { renderWithTheme } from '../../test/helpers'
import { ArcDashboardFrame } from './ArcDashboardFrame'
import { DashboardContent } from './Dashboard'

describe('ArcDashboardFrame', () => {
  it('shows loading before the ARC is available', () => {
    const store = createArcStore(sampleCrateSource())
    renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={DashboardContent} label="ARC-Dashboard" arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByRole('status')).toHaveTextContent('Loading ARC')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows the ARC load failure', async () => {
    const source = sampleCrateSource()
    const store = createArcStore({ ...source, fetchROCrate: async () => { throw new Error('Unable to load RO-Crate (404).') } })
    await store.load()
    renderWithTheme(<ArcProvider store={store}><ArcDashboardFrame content={DashboardContent} label="ARC-Dashboard" arcJson={crateJson} /></ArcProvider>)
    expect(screen.getByText('Could not load ARC')).toBeVisible()
    expect(screen.getByText('Unable to load RO-Crate (404).')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })
})
