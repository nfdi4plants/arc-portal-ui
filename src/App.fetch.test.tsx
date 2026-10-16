import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { availableDataHubs, defaultDataHub } from './config/gitlab.ts'
import { deferred, gitLabProjectFull, openAccountMenu, projectResponse, stubGitLabFetch } from './test/helpers.tsx'

const account = { id: 7, name: 'Jane', username: 'jane' }
const officialHost = new URL(defaultDataHub.url).host
const otherHub = availableDataHubs[1]
const otherHost = new URL(otherHub.url).host

beforeEach(() => localStorage.clear())
afterEach(() => vi.useRealTimers())

function transport() {
  const call = stubGitLabFetch(async (url, init) => {
    if (url.pathname === '/api/v4/user') return Response.json(account)
    if (url.pathname === '/api/v4/groups') return Response.json(
      [{ id: 2, name: 'Plants', full_path: 'research/plants' }], { headers: { 'X-Next-Page': '' } })
    if (url.pathname === '/api/v4/groups/2/projects') return projectResponse([gitLabProjectFull()], { 'X-Total': '3', 'X-Next-Page': '' })
    if (url.pathname === '/api/v4/projects') {
      if (url.searchParams.get('per_page') === '1') return projectResponse([gitLabProjectFull()], { 'X-Total': '26' })
      const token = new Headers(init?.headers).get('Authorization')
      const page = Number(url.searchParams.get('page'))
      return projectResponse([gitLabProjectFull({
        name: (token ? 'Private ' : '') + url.host + ' ARC ' + page,
        visibility: token ? 'private' : 'public',
      })], { 'X-Total': '26', 'X-Next-Page': page === 1 ? '2' : '', 'X-Prev-Page': page === 1 ? '' : '1' })
    }
    throw new Error('Unexpected request: ' + url)
  })
  vi.stubGlobal('fetch', call)
  return call
}

function requests(call: ReturnType<typeof transport>, host?: string, path?: string, params: Record<string, string> = {}) {
  return call.mock.calls.filter(([input]) => {
    const url = new URL(String(input))
    return (!host || url.host === host) && (!path || url.pathname === path)
      && Object.entries(params).every(([key, value]) => url.searchParams.get(key) === value)
  })
}

describe('dashboard request lifecycle', () => {
  it.each([false, true])('loads one selected page, stays idle, and refreshes on Update (StrictMode: %s)', async strictMode => {
    const call = transport()
    const user = userEvent.setup()
    const { rerender } = render(<App />, { reactStrictMode: strictMode })
    await screen.findByRole('button', { name: 'Open ' + officialHost + ' ARC 1' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled())
    const mounts = strictMode ? 2 : 1
    for (const hub of availableDataHubs) {
      const host = new URL(hub.url).host
      expect(requests(call, host, '/api/v4/projects', { per_page: '1' })).toHaveLength(mounts)
      expect(requests(call, host, '/api/v4/groups')).toHaveLength(mounts)
    }
    expect(requests(call, officialHost, '/api/v4/projects', { per_page: '25', page: '1' })).toHaveLength(mounts)
    expect(requests(call, otherHost, '/api/v4/projects', { per_page: '25' })).toHaveLength(0)
    expect(requests(call, undefined, '/api/v4/projects', { page: '2' })).toHaveLength(0)
    expect(call.mock.calls.some(([input]) => String(input).includes('/repository/'))).toBe(false)
    expect(requests(call, undefined, '/api/v4/projects', { membership: 'true' })).toHaveLength(0)
    const loaded = call.mock.calls.length
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'plants')
    await user.click(screen.getByRole('button', { name: 'Favorite research/plants on ' + defaultDataHub.name }))
    rerender(<App />)
    vi.useFakeTimers()
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    vi.useRealTimers()
    expect(call).toHaveBeenCalledTimes(loaded)
    await user.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled())
    expect(call).toHaveBeenCalledTimes(loaded + availableDataHubs.length * 2 + 1)
  })

  it('waits for every saved-token check and starts once with settled sessions', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({
      [defaultDataHub.id]: 'official-token', [otherHub.id]: 'other-token',
    }))
    const call = transport()
    const original = call.getMockImplementation()!
    const official = deferred<Response>()
    const other = deferred<Response>()
    call.mockImplementation((input, init) => {
      const url = new URL(String(input))
      return url.pathname === '/api/v4/user' ? (url.host === officialHost ? official.promise : other.promise) : original(input, init)
    })
    render(<App />)
    expect(screen.getByRole('status', { name: 'Checking saved logins' })).toBeVisible()
    expect(screen.getByRole('navigation')).toBeVisible()
    expect(call).toHaveBeenCalledTimes(2)
    await act(async () => official.resolve(Response.json(account)))
    expect(call).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
    await act(async () => other.resolve(Response.json({}, { status: 401 })))
    expect(await screen.findByRole('button', { name: 'Open Private ' + officialHost + ' ARC 1' })).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled())
    expect(screen.queryByRole('status', { name: 'Checking saved logins' })).not.toBeInTheDocument()
    expect(requests(call, officialHost, '/api/v4/projects', { per_page: '25' })).toHaveLength(1)
    expect(requests(call, otherHost, '/api/v4/groups', { all_available: 'false' })).toHaveLength(0)
    expect(requests(call, officialHost, '/api/v4/groups', { all_available: 'false' })).toHaveLength(1)
    expect(requests(call, officialHost, '/api/v4/projects').every(([, init]) =>
      new Headers(init?.headers).get('Authorization') === 'Bearer official-token')).toBe(true)
    expect(requests(call, otherHost, '/api/v4/projects').every(([, init]) =>
      !new Headers(init?.headers).has('Authorization'))).toBe(true)
  })

  it('settles a failed saved login and keeps the dashboard mounted through a later retry', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ [defaultDataHub.id]: 'saved-token' }))
    const call = transport()
    const original = call.getMockImplementation()!
    let attempts = 0
    const pending = deferred<Response>()
    call.mockImplementation((input, init) => {
      if (new URL(String(input)).pathname !== '/api/v4/user') return original(input, init)
      attempts++
      return attempts === 1 ? Promise.reject(new TypeError('Offline')) : pending.promise
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Open ' + officialHost + ' ARC 1' })
    await user.type(screen.getByRole('searchbox', { name: 'Search groups' }), 'plants')
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Login to GitLab' }))
    const loaded = call.mock.calls.length
    await user.click(dialog.getByRole('button', { name: 'Retry saved login' }))
    expect(screen.getByRole('button', { name: 'Open ' + officialHost + ' ARC 1' })).toBeVisible()
    expect(call).toHaveBeenCalledTimes(loaded + 1)
    await act(async () => pending.resolve(Response.json(account)))
    await screen.findByRole('button', { name: 'Open Private ' + officialHost + ' ARC 1' })
    expect(screen.getByRole('searchbox', { name: 'Search groups' })).toHaveValue('plants')
    expect(requests(call, otherHost, '/api/v4/projects', { per_page: '1' })).toHaveLength(1)
    expect(requests(call, otherHost, '/api/v4/groups')).toHaveLength(1)
  })

  it('refreshes only the logged-in hub, preserves table filters, and removes private rows on logout', async () => {
    const call = transport()
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Open ' + officialHost + ' ARC 1' })
    await user.type(screen.getByRole('searchbox', { name: 'Search ARCs' }), 'plant{Enter}')
    await screen.findByRole('button', { name: 'Open ' + officialHost + ' ARC 1' })
    const otherCalls = requests(call, otherHost).length
    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Login to GitLab' }))
    await user.type(dialog.getByLabelText('Personal access token'), 'new-token{Enter}')
    await screen.findByRole('button', { name: 'Open Private ' + officialHost + ' ARC 1' })
    expect(screen.getByRole('searchbox', { name: 'Search ARCs' })).toHaveValue('plant')
    expect(requests(call, otherHost)).toHaveLength(otherCalls)
    const original = call.getMockImplementation()!
    const pending = deferred<Response>()
    call.mockImplementation((input, init) => {
      const url = new URL(String(input))
      return url.host === officialHost && url.pathname === '/api/v4/projects' && url.searchParams.get('per_page') === '25'
        ? pending.promise : original(input, init)
    })
    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(screen.queryByRole('button', { name: 'Open Private ' + officialHost + ' ARC 1' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search ARCs' })).toHaveValue('plant')
    expect(requests(call, otherHost)).toHaveLength(otherCalls)
    await act(async () => pending.resolve(projectResponse([gitLabProjectFull({ name: 'Public after logout' })], { 'X-Next-Page': '' })))
    expect(await screen.findByRole('button', { name: 'Open Public after logout' })).toBeVisible()
  })

  it('allows cancellation of saved-token validation to release the initial loading screen', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ [defaultDataHub.id]: 'saved-token' }))
    const call = transport()
    const original = call.getMockImplementation()!
    const pending = deferred<Response>()
    call.mockImplementation((input, init) => new URL(String(input)).pathname === '/api/v4/user' ? pending.promise : original(input, init))
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Login to GitLab' })).getByRole('button', { name: 'Cancel' }))
    await screen.findByRole('button', { name: 'Open ' + officialHost + ' ARC 1' })
    await act(async () => pending.resolve(Response.json(account)))
    expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument()
    expect(requests(call, officialHost, '/api/v4/projects', { per_page: '25' })).toHaveLength(1)
  })
})
