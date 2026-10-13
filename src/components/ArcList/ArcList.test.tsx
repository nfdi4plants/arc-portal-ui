import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { project, renderWithTheme } from '../../test/helpers.tsx'
import { ArcList } from './ArcList.tsx'

describe('ArcList', () => {
  it('renders a semantic list with ARC links, namespace, description and stars', () => {
    const arc = project()
    renderWithTheme(<ArcList projects={[arc]} label="Research contexts" />)
    const list = screen.getByRole('list', { name: 'Research contexts' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(within(list).getByRole('link', { name: arc.name })).toHaveAttribute('href', arc.web_url)
    expect(within(list).getByText(arc.path_with_namespace)).toBeVisible()
    expect(within(list).getByText(arc.description!)).toBeVisible()
    expect(within(list).getByLabelText('42 stars')).toBeVisible()
  })

  it.each([null, '', '   '])('handles missing descriptions (%s) and zero stars', description => {
    renderWithTheme(<ArcList projects={[project({ description, star_count: 0 })]} label="ARCs" />)
    expect(screen.getByText('No description provided.')).toBeVisible()
    expect(screen.getByLabelText('0 stars')).toBeVisible()
  })
})
