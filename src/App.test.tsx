import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { gitLabProjectFull, projectResponse } from './test/helpers.tsx'
import { availableDataHubs } from './config/gitlab.ts'
import App from './App.tsx'

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

it('lists the selected DataHUB page and counts every configured DataHUB', async () => {
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Open git.nfdi4plants.org ARC' })).toBeVisible()
  const projectsCall = fetchCall.mock.calls.find(call => new URL(String(call[0])).pathname === '/api/v4/projects'
    && new URL(String(call[0])).searchParams.get('per_page') === '25')!
  const params = new URL(String(projectsCall[0])).searchParams
  expect(params.get('visibility')).toBe('public')
  expect(params.get('order_by')).toBe('last_activity_at')
  expect(new Headers(projectsCall[1]?.headers).has('PRIVATE-TOKEN')).toBe(false)
  const projectCalls = fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname === '/api/v4/projects')
  // One fast count per hub, and only one selected project page.
  expect(projectCalls).toHaveLength(availableDataHubs.length + 1)
  const hosts = new Set(projectCalls.map(call => new URL(String(call[0])).host))
  expect(hosts).toEqual(new Set(availableDataHubs.map(hub => new URL(hub.url).host)))
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
