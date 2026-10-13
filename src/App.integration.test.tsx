import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { defaultDataHub } from './config/gitlab.ts'
import { deferred, openAccountMenu, project, projectResponse } from './test/helpers.tsx'

const account = { id: 7, name: 'Jane Doe', username: 'jane' }
const publicMembership = { id: 10, name: 'Shared lab', full_path: 'shared-lab', visibility: 'public' }
const privateMembership = { id: 20, name: 'Private lab', full_path: 'private-lab', visibility: 'private' }
const otherPublic = { id: 30, name: 'Public plants', full_path: 'public-plants', visibility: 'public' }
const fetchCall = vi.fn<typeof fetch>()

function hasToken(init?: RequestInit) { return new Headers(init?.headers).has('PRIVATE-TOKEN') }
function userCalls() { return fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname === '/api/v4/user') }

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockReset()
  fetchCall.mockImplementation(async (input, init) => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v4/user') return Response.json(account)
    if (url.pathname === '/api/v4/groups') return Response.json(
      hasToken(init) ? [publicMembership, privateMembership] : [publicMembership, otherPublic],
      { headers: { 'X-Next-Page': '' } },
    )
    if (url.pathname.startsWith('/api/v4/groups/')) return projectResponse([project({ name: 'Private organisation ARC' })])
    return projectResponse([project({ name: url.searchParams.has('search')
      ? hasToken(init) ? 'Private matching ARC' : 'Public matching ARC'
      : 'Featured public ARC' })])
  })
  vi.stubGlobal('fetch', fetchCall)
})

async function openLogin(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Login' }))
  return within(screen.getByRole('dialog', { name: 'Login to GitLab' }))
}

describe('optional login in the portal', () => {
  it('keeps discovery public, authenticates through Enter, expands search and groups, and clears private results on logout', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('link', { name: 'Featured public ARC' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Organisation' })).toBeVisible()
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

    const selector = screen.getByRole('combobox', { name: 'Organisation' })
    await waitFor(() => expect(within(selector).getByRole('group', { name: 'Your organisations' })).toBeInTheDocument())
    expect(within(selector).getAllByRole('option', { name: 'shared-lab' })).toHaveLength(1)
    expect(within(selector).getByRole('group', { name: 'Other public organisations' })).toHaveTextContent('public-plants')
    await user.selectOptions(selector, '20')
    expect(await screen.findByRole('link', { name: 'Private organisation ARC' })).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Search term' }), 'plants{Enter}')
    expect(await screen.findByRole('link', { name: 'Private matching ARC' })).toBeVisible()
    const searchCall = fetchCall.mock.calls.find(call => new URL(String(call[0])).searchParams.has('search'))!
    expect(new URL(String(searchCall[0])).searchParams.has('visibility')).toBe(false)
    expect(new Headers(searchCall[1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(fetchCall.mock.calls.every(call => !String(call[0]).includes('runtime-token'))).toBe(true)

    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Private matching ARC' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Private organisation ARC' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'private-lab' })).not.toBeInTheDocument()
    expect(selector).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Search term' })).toHaveValue('plants')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByRole('link', { name: 'Public matching ARC' })).toBeVisible()
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
    expect(await screen.findByRole('link', { name: 'Featured public ARC' })).toBeVisible()
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
    expect(await screen.findByRole('link', { name: 'Featured public ARC' })).toBeVisible()
    await waitFor(() => expect(screen.queryByText('Checking login…')).not.toBeInTheDocument())
    const dialog = await openLogin(user)
    expect(dialog.getByRole('alert')).toHaveTextContent('Unable to reach GitLab')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('saved-token')
    await user.click(dialog.getByRole('button', { name: 'Retry saved login' }))
    await waitFor(() => expect(userCalls()).toHaveLength(2))
    await user.click(dialog.getByRole('button', { name: 'Forget saved login' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(dialog.queryByRole('button', { name: 'Retry saved login' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Featured public ARC' })).toBeVisible()
  })
})
