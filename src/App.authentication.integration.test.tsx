import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Primer dialogs and tables render slowly in jsdom when the suite runs in parallel.
vi.setConfig({ testTimeout: 15000 })
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { dataHubCollection, defaultDataHub } from './config/gitlab.ts'
import type { GitLabInstance } from './types/gitlab.ts'
import { deferred, gitLabProjectFull, openAccountMenu, projectResponse, stubGitLabFetch } from './test/helpers.tsx'

const microbe = dataHubCollection.supported[0]
const rptu = dataHubCollection.supported[1]
const fetchCall = stubGitLabFetch(async (url, init) => {
  const token = requestToken(init)
  if (url.pathname === '/api/v4/user') return Response.json({
    id: 7, name: `Researcher at ${url.host}`, username: 'researcher', avatar_url: `https://${url.host}/uploads/avatar.png`,
  })
  if (url.pathname === '/api/v4/groups') return Response.json([
    { id: token ? 20 : 10, name: token ? 'Private lab' : 'Public lab', full_path: `${url.host}/${token ? 'private' : 'public'}` },
  ], { headers: { 'X-Next-Page': '' } })
  return projectResponse([gitLabProjectFull({ name: token ? `${url.host} private ARC` : `${url.host} public ARC` })])
})

function requestUrl(input: Parameters<typeof fetch>[0]) { return new URL(String(input)) }
function requestToken(init?: RequestInit) { return new Headers(init?.headers).get('PRIVATE-TOKEN') }
function savedTokens() { return JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) ?? '{}') }
function navbar() { return within(screen.getByRole('navigation', { name: 'Main navigation' })) }
function openRow(host: string, visibility: 'private' | 'public') {
  return screen.getByRole('button', { name: `Open ${host} ${visibility} ARC` })
}

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockClear()
  vi.stubGlobal('fetch', fetchCall)
})

async function openLogin(user: ReturnType<typeof userEvent.setup>) {
  if (navbar().queryByRole('button', { name: 'Account menu' })) {
    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Manage logins' }))
  } else {
    await user.click(navbar().getByRole('button', { name: 'Login' }))
  }
  return within(screen.getByRole('dialog', { name: 'Login to GitLab' }))
}

function expectTokenLink(dialog: ReturnType<typeof within>, dataHub: GitLabInstance) {
  const url = new URL(dialog.getByRole('link', { name: 'Generate a GitLab Personal Access Token' }).getAttribute('href')!)
  expect(url.origin).toBe(new URL(dataHub.url).origin)
  expect(url.pathname).toBe('/-/user_settings/personal_access_tokens')
  expect(url.searchParams.get('scopes')).toBe('read_user,read_api')
}

async function loginTo(user: ReturnType<typeof userEvent.setup>, dataHub: GitLabInstance, token: string) {
  const dialog = await openLogin(user)
  await user.selectOptions(dialog.getByRole('combobox', { name: 'GitLab instance' }), dataHub.id)
  expectTokenLink(dialog, dataHub)
  await user.type(dialog.getByLabelText('Personal access token'), `${token}{Enter}`)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(navbar().getByRole('button', { name: 'Account menu' })).toBeVisible()
}

describe('DataHub logins', () => {
  it('opens account details from the avatar and switches between active logins without changing the dashboard', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ [defaultDataHub.id]: 'official-token', [microbe.id]: 'microbe-token' }))
    const user = userEvent.setup()
    render(<App />)
    const avatarButton = await screen.findByRole('button', { name: 'Account menu' })
    expect(avatarButton.querySelector('img')).toHaveAttribute('src', 'https://git.nfdi4plants.org/uploads/avatar.png')
    expect(navbar().queryByText('Researcher at git.nfdi4plants.org')).not.toBeInTheDocument()
    expect(navbar().queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
    await user.tab()
    await user.tab()
    expect(avatarButton).toHaveFocus()
    await user.keyboard('{Enter}')
    let menu = within(await screen.findByRole('dialog', { name: 'Signed-in accounts' }))
    expect(menu.getByText('Researcher at git.nfdi4plants.org')).toBeVisible()
    expect(menu.getByText('@researcher')).toBeVisible()
    expect(menu.getByRole('link', { name: defaultDataHub.name })).toHaveAttribute('href', defaultDataHub.url)
    expect(menu.getByRole('button', { name: microbe.name })).toBeVisible()
    expect(menu.queryByRole('button', { name: rptu.name })).not.toBeInTheDocument()
    expect(openRow('git.nfdi4plants.org', 'private')).toBeVisible()
    expect(openRow('gitlab.plantmicrobe.de', 'private')).toBeVisible()
    await user.click(menu.getByRole('button', { name: microbe.name }))
    expect(screen.queryByRole('dialog', { name: 'Signed-in accounts' })).not.toBeInTheDocument()
    // Switching the active account only affects the navigation; the dashboard keeps every DataHUB.
    expect(openRow('git.nfdi4plants.org', 'private')).toBeVisible()
    expect(openRow('gitlab.plantmicrobe.de', 'private')).toBeVisible()
    menu = await openAccountMenu(user)
    expect(menu.getByText('Researcher at gitlab.plantmicrobe.de')).toBeVisible()
    expect(menu.getByRole('link', { name: microbe.name })).toHaveAttribute('href', microbe.url)
    expect(menu.getByRole('button', { name: defaultDataHub.name })).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Signed-in accounts' })).not.toBeInTheDocument()
    expect(avatarButton).toHaveFocus()
    await openAccountMenu(user)
    await user.keyboard('{Escape}')
    expect(fetchCall.mock.calls.filter(call => requestUrl(call[0]).pathname === '/api/v4/user')).toHaveLength(2)
  })

  it('stores multiple tokens by ID, uses each only for its own DataHUB, and logs out one account independently', async () => {
    const user = userEvent.setup()
    render(<App />)
    await loginTo(user, defaultDataHub, 'official-token')
    await loginTo(user, microbe, 'microbe-token')
    expect(savedTokens()).toEqual({ [defaultDataHub.id]: 'official-token', [microbe.id]: 'microbe-token' })
    expect(await screen.findByRole('button', { name: 'Open git.nfdi4plants.org private ARC' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open gitlab.plantmicrobe.de private ARC' })).toBeVisible()

    const microbeProjects = fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === 'gitlab.plantmicrobe.de'
      && requestUrl(call[0]).pathname === '/api/v4/projects')
    const microbeTokenCall = microbeProjects.find(call => requestToken(call[1]) === 'microbe-token')!
    expect(microbeTokenCall).toBeDefined()
    expect(requestUrl(microbeTokenCall[0]).searchParams.has('visibility')).toBe(false)
    const officialProjects = fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === 'git.nfdi4plants.org' && requestUrl(call[0]).pathname === '/api/v4/projects')
    expect(officialProjects.some(call => requestToken(call[1]) === 'official-token')).toBe(true)
    expect(fetchCall.mock.calls.every(call => requestToken(call[1]) !== 'official-token' || requestUrl(call[0]).host === 'git.nfdi4plants.org')).toBe(true)
    expect(fetchCall.mock.calls.every(call => requestToken(call[1]) !== 'microbe-token' || requestUrl(call[0]).host === 'gitlab.plantmicrobe.de')).toBe(true)

    let menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(savedTokens()).toEqual({ [defaultDataHub.id]: 'official-token' })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open gitlab.plantmicrobe.de private ARC' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open gitlab.plantmicrobe.de public ARC' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open git.nfdi4plants.org private ARC' })).toBeVisible()
  }, 15_000)

  it('restores saved logins for multiple DataHubs and can forget one while retaining the other', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ [defaultDataHub.id]: 'official-token', [microbe.id]: 'microbe-token' }))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Account menu' })
    expect(await screen.findByRole('button', { name: 'Open git.nfdi4plants.org private ARC' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open gitlab.plantmicrobe.de private ARC' })).toBeVisible()
    const validationCalls = fetchCall.mock.calls.filter(call => requestUrl(call[0]).pathname === '/api/v4/user')
    expect(validationCalls).toHaveLength(2)
    expect(validationCalls.map(call => [requestUrl(call[0]).host, requestToken(call[1])])).toEqual([
      ['git.nfdi4plants.org', 'official-token'], ['gitlab.plantmicrobe.de', 'microbe-token'],
    ])
    const dialog = await openLogin(user)
    await user.selectOptions(dialog.getByRole('combobox', { name: 'GitLab instance' }), microbe.id)
    expect(dialog.getByText(/Signed in as Researcher at gitlab.plantmicrobe.de/)).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Forget saved login' }))
    expect(savedTokens()).toEqual({ [defaultDataHub.id]: 'official-token' })
    await user.click(dialog.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open gitlab.plantmicrobe.de private ARC' })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Open gitlab.plantmicrobe.de public ARC' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Open git.nfdi4plants.org private ARC' })).toBeVisible()
  })

  it('updates PAT links and cancels validation when the login instance changes', async () => {
    const pending = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation((input, init) => {
      const url = requestUrl(input)
      return url.host === 'git.nfdi4plants.org' && url.pathname === '/api/v4/user' ? pending.promise : transport(input, init)
    })
    const user = userEvent.setup()
    render(<App />)
    const dialog = await openLogin(user)
    await user.type(dialog.getByLabelText('Personal access token'), 'old-token{Enter}')
    expect(dialog.getByRole('button', { name: 'Login' })).toBeDisabled()
    for (const dataHub of [microbe, rptu]) {
      await user.selectOptions(dialog.getByRole('combobox', { name: 'GitLab instance' }), dataHub.id)
      expectTokenLink(dialog, dataHub)
      expect(dialog.getByLabelText('Personal access token')).toHaveValue('')
    }
    const oldCall = fetchCall.mock.calls.find(call => requestUrl(call[0]).pathname === '/api/v4/user')!
    expect(oldCall[1]?.signal?.aborted).toBe(true)
    await act(async () => pending.resolve(Response.json({ id: 7, name: 'Old account', username: 'old' })))
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(savedTokens()).toEqual({})
    await user.type(dialog.getByLabelText('Personal access token'), 'rptu-token{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(savedTokens()).toEqual({ [rptu.id]: 'rptu-token' })
    expect(await screen.findByRole('button', { name: 'Open datahub.rz.rptu.de private ARC' })).toBeVisible()
  })

  it('falls back to public ARCs when a saved token is rejected by the project list', async () => {
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation(async (input, init) => {
      const url = requestUrl(input)
      const token = requestToken(init)
      if (url.host === 'gitlab.plantmicrobe.de' && url.pathname === '/api/v4/projects' && token) {
        return Response.json({ message: '401 Unauthorized' }, { status: 401 })
      }
      return transport(input, init)
    })
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ [microbe.id]: 'microbe-token' }))
    render(<App />)
    expect(await screen.findByText('Your login for gitlab.plantmicrobe.de has expired')).toBeVisible()
    expect(screen.getByText('Showing public ARCs only. Log in again to see private ARCs.')).toBeVisible()
    expect(await screen.findByRole('button', { name: 'Open gitlab.plantmicrobe.de public ARC' })).toBeVisible()
  })
})