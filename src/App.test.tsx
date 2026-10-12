import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import App from './App.tsx'
import { referenceGitLab } from './config/gitlab.ts'
import { project, projectResponse } from './test/helpers.tsx'

it('composes independent ARC sections using the reference source', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async url => {
    const request = new URL(String(url))
    if (request.searchParams.has('search')) return Response.json({ message: 'Search unavailable' }, { status: 503 })
    return projectResponse([project({ name: 'Featured ARC' })])
  })
  render(<App fetchCall={fetchMock} />)
  const featured = screen.getByRole('region', { name: 'Most-starred ARCs' })
  const search = screen.getByRole('region', { name: 'Search ARCs' })
  expect(await within(featured).findByRole('link', { name: 'Featured ARC' })).toBeVisible()
  expect(within(search).queryByRole('list')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Explore the reference GitLab instance/ })).toHaveAttribute('href', referenceGitLab.exploreUrl)

  const user = userEvent.setup()
  await user.type(within(search).getByRole('textbox'), 'plants{Enter}')
  expect(await within(search).findByRole('alert')).toHaveTextContent('503')
  expect(within(featured).getByRole('link', { name: 'Featured ARC' })).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(2)
  for (const [url] of fetchMock.mock.calls) expect(new URL(String(url)).origin).toBe(referenceGitLab.source)
})

it('can search successfully even when the most-starred list fails', async () => {
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async url => {
    if (new URL(String(url)).searchParams.has('search')) return projectResponse([project({ name: 'Matching ARC' })])
    return Response.json({ message: 'Ranking unavailable' }, { status: 500 })
  })
  render(<App fetchCall={fetchMock} />)
  const featured = screen.getByRole('region', { name: 'Most-starred ARCs' })
  const search = screen.getByRole('region', { name: 'Search ARCs' })
  expect(await within(featured).findByRole('alert')).toHaveTextContent('500')
  const user = userEvent.setup()
  await user.type(within(search).getByRole('textbox'), 'plants{Enter}')
  expect(await within(search).findByRole('link', { name: 'Matching ARC' })).toBeVisible()
  expect(within(featured).getByRole('alert')).toHaveTextContent('500')
})
