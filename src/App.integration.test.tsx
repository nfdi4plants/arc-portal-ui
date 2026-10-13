import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { deferred, gitLabProjectFull, projectResponse } from './test/helpers.tsx'

const account = { id: 7, name: 'Jane Doe', username: 'jane' }
const fetchCall = vi.fn<typeof fetch>()

function hasToken(init?: RequestInit) { return new Headers(init?.headers).has('PRIVATE-TOKEN') }
function userCalls() { return fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname === '/api/v4/user') }

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockReset()
  fetchCall.mockImplementation(async input => {
    const url = new URL(String(input))
    if (url.pathname === '/api/v4/user') return Response.json(account)
    if (url.pathname === '/api/v4/groups') return Response.json([], { headers: { 'X-Next-Page': '' } })
    return projectResponse([gitLabProjectFull({ name: 'Featured public ARC' })], { 'X-Next-Page': '' })
  })
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
    expect(await screen.findByRole('button', { name: 'Open Featured public ARC' })).toBeVisible()
    expect(userCalls()).toHaveLength(0)
    const dialog = await openLogin(user)
    expect(dialog.getByRole('button', { name: 'Login' })).toBeDisabled()
    const tokenLink = new URL(dialog.getByRole('link', { name: 'Generate a GitLab Personal Access Token' }).getAttribute('href')!)
    expect(tokenLink.searchParams.get('name')).toBe('arc-portal')
    expect(tokenLink.searchParams.get('scopes')).toBe('read_user,read_api')
    await user.type(dialog.getByLabelText('Personal access token'), ' runtime-token {Enter}')
    expect(await screen.findByText('Jane Doe')).toBeVisible()
    expect(screen.getByText('@jane')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('runtime-token')
    expect(localStorage.length).toBe(1)

    const projectCalls = () => fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname === '/api/v4/projects')
    await waitFor(() => expect(projectCalls().some(call => hasToken(call[1]))).toBe(true))
    const authenticated = projectCalls().find(call => hasToken(call[1]))!
    expect(new Headers(authenticated[1]?.headers).get('PRIVATE-TOKEN')).toBe('runtime-token')
    expect(new URL(String(authenticated[0])).searchParams.has('visibility')).toBe(false)
    expect(fetchCall.mock.calls.every(call => !String(call[0]).includes('runtime-token'))).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(await screen.findByRole('button', { name: 'Open Featured public ARC' })).toBeVisible()
    await waitFor(() => expect(new URL(String(projectCalls().at(-1)![0])).searchParams.get('visibility')).toBe('public'))
    expect(hasToken(projectCalls().at(-1)![1])).toBe(false)
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
    expect(await screen.findByRole('button', { name: 'Logout' })).toBeVisible()
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
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
    expect(localStorage.length).toBe(0)
    const reopened = await openLogin(user)
    expect(reopened.getByLabelText('Personal access token')).toHaveValue('')
  })

  it('validates saved credentials while public discovery stays available', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'saved-token')
    const pending = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation((input, init) => new URL(String(input)).pathname === '/api/v4/user'
      ? pending.promise : transport(input, init))
    render(<App />)
    expect(await screen.findByRole('button', { name: 'Open Featured public ARC' })).toBeVisible()
    expect(screen.getByText('Checking login…')).toBeVisible()
    const discoveryCalls = fetchCall.mock.calls.filter(call => new URL(String(call[0])).pathname !== '/api/v4/user')
    expect(discoveryCalls.every(call => !hasToken(call[1]))).toBe(true)
    await act(async () => pending.resolve(Response.json(account)))
    expect(await screen.findByText('Jane Doe')).toBeVisible()
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('saved-token')
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
    expect(await screen.findByRole('button', { name: 'Open Featured public ARC' })).toBeVisible()
    await waitFor(() => expect(screen.queryByText('Checking login…')).not.toBeInTheDocument())
    const dialog = await openLogin(user)
    expect(dialog.getByRole('alert')).toHaveTextContent('Unable to reach GitLab')
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBe('saved-token')
    await user.click(dialog.getByRole('button', { name: 'Retry saved login' }))
    await waitFor(() => expect(userCalls()).toHaveLength(2))
    await user.click(dialog.getByRole('button', { name: 'Forget saved login' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(dialog.queryByRole('button', { name: 'Retry saved login' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Featured public ARC' })).toBeVisible()
  })
})
