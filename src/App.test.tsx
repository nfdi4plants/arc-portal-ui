import { render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { gitLabProjectFull, projectResponse } from './test/helpers.tsx'
import App from './App.tsx'

const fetchCall = vi.fn<typeof fetch>()

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockReset()
  fetchCall.mockImplementation(async input => new URL(String(input)).pathname === '/api/v4/groups'
    ? Response.json([], { headers: { 'X-Next-Page': '' } })
    : projectResponse([gitLabProjectFull({ name: 'Featured public ARC' })], { 'X-Next-Page': '' }))
  vi.stubGlobal('fetch', fetchCall)
})

it('lists the public ARCs of the reference DataHUB in the dashboard table', async () => {
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Open Featured public ARC' })).toBeVisible()
  const projectsCall = fetchCall.mock.calls.find(call => new URL(String(call[0])).pathname === '/api/v4/projects')!
  const params = new URL(String(projectsCall[0])).searchParams
  expect(params.get('visibility')).toBe('public')
  expect(params.get('order_by')).toBe('last_activity_at')
  expect(new Headers(projectsCall[1]?.headers).has('PRIVATE-TOKEN')).toBe(false)
})
