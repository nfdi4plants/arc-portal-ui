import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WorkingGroupChart, type WorkingGroupChartProps } from './WorkingGroupChart.tsx'
import { renderWithTheme } from '../../test/helpers.tsx'

const base: WorkingGroupChartProps = {
  myItems: [{ key: 'g/ceplas', label: 'CEPLAS', count: 2 }],
  publicItems: [{ key: 'g/ceplas', label: 'CEPLAS', count: 3 }],
  loggedIn: false,
  membershipErrors: [],
  onToggle: vi.fn(),
}

describe('WorkingGroupChart', () => {
  it('follows login and logout with the selected tab', async () => {
    const { rerender } = renderWithTheme(<WorkingGroupChart {...base} />)
    expect(screen.getByRole('tab', { name: 'Public ARCs' })).toHaveAttribute('aria-selected', 'true')
    rerender(<WorkingGroupChart {...base} loggedIn />)
    expect(screen.getByRole('tab', { name: 'My ARCs' })).toHaveAttribute('aria-selected', 'true')
    rerender(<WorkingGroupChart {...base} loggedIn={false} />)
    expect(screen.getByRole('tab', { name: 'Public ARCs' })).toHaveAttribute('aria-selected', 'true')
  })

  it('respects the visitor choice while the login state is unchanged', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithTheme(<WorkingGroupChart {...base} loggedIn />)
    await user.click(screen.getByRole('tab', { name: 'Public ARCs' }))
    rerender(<WorkingGroupChart {...base} loggedIn myItems={[]} />)
    expect(screen.getByRole('tab', { name: 'Public ARCs' })).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps the My ARCs bars and names the DataHUBs whose memberships failed', () => {
    renderWithTheme(<WorkingGroupChart {...base} loggedIn membershipErrors={['Other Hub']} />)
    expect(screen.getByRole('button', { name: /CEPLAS: 2 ARCs/ })).toBeVisible()
    expect(screen.getByText('Could not load your memberships for Other Hub.')).toBeVisible()
  })
})
