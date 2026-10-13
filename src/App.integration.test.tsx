import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Primer dialogs and tables render slowly in jsdom when the suite runs in parallel.
vi.setConfig({ testTimeout: 15000 })
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { defaultDataHub } from './config/gitlab.ts'
import { deferred, gitLabProjectFull, openAccountMenu, projectResponse, stubGitLabFetch } from './test/helpers.tsx'

const account = { id: 7, name: 'Jane Doe', username: 'jane' }
const officialHost = new URL(defaultDataHub.url).host
const fetchCall = stubGitLabFetch(async url => {
  if (url.pathname === '/api/v4/user') return Response.json(account)
  if (url.pathname === '/api/v4/groups') return Response.json([], { headers: { 'X-Next-Page': '' } })
  return projectResponse([gitLabProjectFull({ name: `${url.host} ARC` })], { 'X-Next-Page': '' })
})

function hasToken(init?: RequestInit) { return new Headers(init?.headers).has('PRIVATE-TOKEN') }
function userCalls() { return fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname === '/api/v4/user') }
function projectCalls(host?: string) {
  return fetchCall.mock.calls.filter(call => {
    const url = new URL(String(call[0]))
    return url.pathname === '/api/v4/projects' && (host === undefined || url.host === host)
  })
}

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockClear()
  vi.stubGlobal('fetch', fetchCall)
})

async function openLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Login' }))
  return within(screen.getByRole('dialog', { name: 'Login to GitLab' }))
}

describe('optional login in the portal', () => {
  it('keeps discovery public, authenticates through Enter and reloads the ARCs with the token', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('button', { name: `Open ${officialHost} ARC` })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open gitlab.plantmicrobe.de ARC' })).toBeVisible()
    expect(userCalls()).toHaveLength(0)
    const dialog = await openLogin(user)
    expect(dialog.getByRole('button', { name: 'Login' })).toBeDisabled()
    const tokenLink = new URL(dialog.getByRole('link', { name: 'Generate a GitLab Personal Access Token' }).getAttribute('href')!)
    expect(tokenLink.searchParams.get('name')).toBe('arc-portal')
    expect(tokenLink.searchParams.get('scopes')).toBe('read_user,read_api')
    await user.type(dialog.getByLabelText('Personal access token'), ' runtime-token {Enter}')
    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Login to GitLab' })).not.toBeInTheDocument()
    const accountMenu = await openAccountMenu(user)
    expect(accountMenu.getByText('Jane Doe')).toBeVisible()
    expect(accountMenu.getByText('@jane')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)!)).toEqual({ [defaultDataHub.id]: 'runtime-token' })
    expect(localStorage.length).toBe(1)

    await waitFor(() => expect(projectCalls(officialHost).some(call => hasToken(call[1]))).toBe(true))
    const authenticated = projectCalls(officialHost).find(call => hasToken(call[1]))!
    expect(new Headers(authenticated[1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(new URL(String(authenticated[0])).searchParams.has('visibility')).toBe(false)
    expect(fetchCall.mock.calls.every(call => !String(call[0]).includes('runtime-token'))).toBe(true)

    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(await screen.findByRole('button', { name: `Open ${officialHost} ARC` })).toBeVisible()
    await waitFor(() => expect(new URL(String(projectCalls(officialHost).at(-1)![0])).searchParams.get('visibility')).toBe('public'))
    expect(hasToken(projectCalls(officialHost).at(-1)![1])).toBe(false)
  })

  it('shows invalid-token and network failures inline and permits retry without persisting unsuccessful tokens', async () => {
    const transport = fetchCall.getMockImplementation()!
    let attempt = 0
    fetchCall.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname !== '/api/v4/user') return transport(input, init)
      attempt++
      if (attempt === 1) return Response.json({}, { status: 401 })
      if (attempt === 2) throw new TypeError('Failed to fetch')
      return Response.json(account)
    })
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openLogin(user)
    await user.type(dialog.getByLabelText('Personal access token'), 'token')
    await user.click(dialog.getByRole('button', { name: 'Login' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent('invalid or expired')
    expect(localStorage.length).toBe(0)
    await user.click(dialog.getByRole('button', { name: 'Login' }))
    await waitFor(() => expect(dialog.getByRole('alert')).toHaveTextContent('Unable to reach GitLab'))
    expect(localStorage.length).toBe(0)
    await user.click(dialog.getByRole('button', { name: 'Login' }))
    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeVisible()
  })

  it('cancels pending validation, prevents duplicate submission and ignores the response after closing the dialog', async () => {
    const pending = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation((input, init) => new URL(String(input)).pathname === '/api/v4/user'
      ? pending.promise : transport(input, init))
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openLogin(user)
    await user.type(dialog.getByLabelText('Personal access token'), 'token{Enter}')
    expect(dialog.getByRole('button', { name: 'Login' })).toBeDisabled()
    await user.click(dialog.getByRole('button', { name: 'Login' }))
    expect(userCalls()).toHaveLength(1)
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(userCalls()[0][1]?.signal?.aborted).toBe(true)
    await act(async () => pending.resolve(Response.json(account)))
    expect(screen.queryByRole('button', { name: 'Account menu' })).not.toBeInTheDocument()
    expect(localStorage.length).toBe(0)
    const reopened = await openLogin(user)
    expect(reopened.getByLabelText('Personal access token')).toHaveValue('')
  })

  it('migrates a saved official-instance token while public discovery stays available', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'saved-token')
    const pending = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation((input, init) => new URL(String(input)).pathname === '/api/v4/user'
      ? pending.promise : transport(input, init))
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('button', { name: `Open ${officialHost} ARC` })).toBeVisible()
    expect(screen.getByText('Checking login…')).toBeVisible()
    const discoveryCalls = fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname !== '/api/v4/user')
    expect(discoveryCalls.every(call => !hasToken(call[1]))).toBe(true)
    await act(async () => pending.resolve(Response.json(account)))
    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeVisible()
    const accountMenu = await openAccountMenu(user)
    expect(accountMenu.getByText('Jane Doe')).toBeVisible()
    expect(JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)!)).toEqual({ [defaultDataHub.id]: 'saved-token' })
  })

  it('preserves a failed saved login for retry and lets the user forget it', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'saved-token')
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname === '/api/v4/user') throw new TypeError('Failed to fetch')
      return transport(input, init)
    })
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('button', { name: `Open ${officialHost} ARC` })).toBeVisible()
    await waitFor(() => expect(screen.queryByText('Checking login…')).not.toBeInTheDocument())
    const dialog = await openLogin(user)
    expect(dialog.getByRole('alert')).toHaveTextContent('Unable to reach GitLab')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('saved-token')
    await user.click(dialog.getByRole('button', { name: 'Retry saved login' }))
    await waitFor(() => expect(userCalls()).toHaveLength(2))
    await user.click(dialog.getByRole('button', { name: 'Forget saved login' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(dialog.queryByRole('button', { name: 'Retry saved login' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Open ${officialHost} ARC` })).toBeVisible()
  })
})