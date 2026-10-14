import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { gitLabProjectFull, projectResponse } from './test/helpers.tsx'
import App from './App.tsx'
import { crateJson } from '../tests/helpers/sampleCrate'
import './test/nativeDialog'

vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => <label>Search ARC files<input /></label> }))

const fetchCall = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockReset()
  fetchCall.mockImplementation(async input => {
    const host = new URL(String(input)).host
    return new URL(String(input)).pathname === '/api/v4/groups'
      ? Response.json([], { headers: { 'X-Next-Page': '' } })
      : projectResponse([gitLabProjectFull({ name: `${host} ARC` })], { 'X-Next-Page': '' })
  })
  vi.stubGlobal('fetch', fetchCall)
})

it('opens an ARC using its project id and the URL of its source DataHUB', async () => {
  const transport = fetchCall.getMockImplementation()!
  fetchCall.mockImplementation((input, init) => {
    const url = new URL(String(input))
    if (url.pathname.includes('/packages/generic/')) return new Promise(() => {})
    if (url.host === 'gitlab.plantmicrobe.de' && url.pathname === '/api/v4/projects') {
      return Promise.resolve(projectResponse([gitLabProjectFull({ id: 42, name: 'Plantmicrobe study' })], { 'X-Next-Page': '' }))
    }
    return transport(input, init)
  })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'gitlab.plantmicrobe.de: 1 ARCs' }))
  await user.click(await screen.findByRole('button', { name: 'Open Plantmicrobe study' }))
  await waitFor(() => expect(fetchCall).toHaveBeenCalledWith(
    'https://gitlab.plantmicrobe.de/api/v4/projects/42/packages/generic/isa_arc_json/0.0.1/arc-ro-crate-metadata.json',
    { headers: expect.any(Headers), signal: expect.any(AbortSignal), credentials: 'omit' },
  ))
  const download = fetchCall.mock.calls.find(([input]) => String(input).includes('/packages/generic/'))!
  expect(new Headers(download[1]?.headers).has('PRIVATE-TOKEN')).toBe(false)
})

it('opens the scrolling dashboard with investigation submenus and returns to discovery', async () => {
  const transport = fetchCall.getMockImplementation()!
  fetchCall.mockImplementation((input, init) => {
    const url = new URL(String(input))
    if (url.pathname.includes('/packages/generic/')) return Promise.resolve(new Response(crateJson))
    if (url.pathname.endsWith('/repository/tree')) return Promise.resolve(Response.json([]))
    return transport(input, init)
  })
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'gitlab.plantmicrobe.de: 1 ARCs' }))
  await user.click(await screen.findByRole('button', { name: 'Open gitlab.plantmicrobe.de ARC' }))

  await screen.findByRole('textbox', { name: 'Search ARC files' }, { timeout: 5000 })
  const dashboard = screen.getByRole('main')
  expect(dashboard).toHaveClass('scrolling-dashboard')
  expect(within(dashboard).getAllByRole('region', { name: / section$/ }).map(region => region.getAttribute('aria-label')))
    .toEqual(['Graphview section', 'Webview section'])
  expect(within(screen.getByRole('navigation', { name: 'Viewer navigation' })).getAllByRole('button').map(button => button.textContent))
    .toEqual(['Investigation', 'Jump to Graphview', 'Jump to Webview'])

  await user.click(screen.getByRole('button', { name: 'Investigation' }))
  await user.click(screen.getByRole('menuitem', { name: 'Contacts (12)' }))
  expect(await screen.findByRole('menu', { name: 'Contacts (12)' })).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(await screen.findByRole('button', { name: 'gitlab.plantmicrobe.de: 1 ARCs' })).toBeVisible()
  expect(screen.queryByRole('navigation', { name: 'Viewer navigation' })).not.toBeInTheDocument()
}, 15000)
