import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { dataHubCollection, defaultDataHub } from './config/gitlab.ts'
import { gitLabProjectFull, openAccountMenu, projectResponse, stubGitLabFetch } from './test/helpers.tsx'

// The bundled web viewer loads raw CSS in its browser build, which node ESM cannot import.
vi.mock('@nfdi4plants/arc-web-view', () => ({ WebViewer: () => null }))

const microbe = dataHubCollection.supported[0]
const microbeHost = new URL(microbe.url).host
const officialHost = new URL(defaultDataHub.url).host
const rptuHost = new URL(dataHubCollection.supported[1].url).host

const fetchCall = stubGitLabFetch(async (url, init) => {
  const token = new Headers(init?.headers).get('PRIVATE-TOKEN')
  if (url.pathname === '/api/v4/user') return Response.json({ id: 7, name: url.host, username: 'researcher' })
  if (url.pathname === '/api/v4/groups') return Response.json(
    [{ id: 10, name: 'Plants', full_path: `${url.host}/plants`, visibility: 'public' }],
    { headers: { 'X-Next-Page': '' } },
  )
  const visibility = token ? 'private' : 'public'
  return projectResponse([gitLabProjectFull({
    name: `${url.host} ${visibility} ARC`, web_url: `https://${url.host}/plants/study`,
  })])
}, {
  [rptuHost]: async () => new Response('Not Found', { status: 404 }),
})

function requestUrl(input: Parameters<typeof fetch>[0]) { return new URL(String(input)) }
function requestToken(init?: RequestInit) { return new Headers(init?.headers).get('PRIVATE-TOKEN') }

beforeEach(() => {
  localStorage.clear()
  fetchCall.mockClear()
  vi.stubGlobal('fetch', fetchCall)
})

describe('multiple GitLab instances', () => {
  it('lists one project per reachable DataHUB and names a failing one', async () => {
    render(<App />)
    expect(await screen.findByRole('button', { name: `Open ${officialHost} public ARC` })).toBeVisible()
    expect(screen.getByRole('button', { name: `Open ${microbeHost} public ARC` })).toBeVisible()
    expect(await screen.findByText(`Could not load ARCs from ${rptuHost}`)).toBeVisible()
    expect(fetchCall.mock.calls.every(call => requestToken(call[1]) === null)).toBe(true)
  })

  it('uses a token only for the logged-in DataHUB and clears its private project on logout without reloading the page', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: `Open ${officialHost} public ARC` })

    await user.click(screen.getByRole('button', { name: 'Login' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Login to GitLab' }))
    await user.selectOptions(dialog.getByRole('combobox', { name: 'GitLab instance' }), microbe.id)
    await user.type(dialog.getByLabelText('Personal access token'), 'microbe-token{Enter}')
    expect(await screen.findByRole('button', { name: `Open ${microbeHost} private ARC` })).toBeVisible()
    expect(JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)!)).toEqual({ [microbe.id]: 'microbe-token' })

    const microbeProjects = fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === microbeHost
      && requestUrl(call[0]).pathname === '/api/v4/projects')
    const tokenCall = microbeProjects.find(call => requestToken(call[1]) === 'microbe-token')!
    expect(tokenCall).toBeDefined()
    expect(requestUrl(tokenCall[0]).searchParams.has('visibility')).toBe(false)
    expect(fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === officialHost).every(call => requestToken(call[1]) === null)).toBe(true)

    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    await waitFor(() => expect(screen.queryByRole('button', { name: `Open ${microbeHost} private ARC` })).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: `Open ${microbeHost} public ARC` })).toBeVisible()
    expect(screen.getByRole('button', { name: `Open ${officialHost} public ARC` })).toBeVisible()
  })

  it('opens an ARC on its single-ARC page and returns to the dashboard', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: `Open ${officialHost} public ARC` }))
    expect(await screen.findByText(new RegExp(`Arc Dashboard: ${officialHost} public ARC`))).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('button', { name: `Open ${officialHost} public ARC` })).toBeVisible()
  })
})