import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { TOKEN_STORAGE_KEY } from './auth/context.ts'
import { dataHubCollection, defaultDataHub } from './config/gitlab.ts'
import { deferred, openAccountMenu, project, projectResponse } from './test/helpers.tsx'
import { crateJson } from '../tests/helpers/sampleCrate.ts'

vi.mock('./components/ArcDashboard/ArcViewer/ArcViewer.tsx', () => ({ default: () => <div>ARC viewer</div> }))

const fetchCall = vi.fn<typeof fetch>()

function requestUrl(input: Parameters<typeof fetch>[0]) { return new URL(String(input)) }
function requestToken(init?: RequestInit) { return new Headers(init?.headers).get('PRIVATE-TOKEN') }
function group(host: string) { return { id: 10, name: 'Plants', full_path: `${host}/plants`, visibility: 'public' } }

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  localStorage.clear()
  fetchCall.mockReset()
  fetchCall.mockImplementation(async input => {
    const url = requestUrl(input)
    if (url.pathname.includes('/packages/generic/')) return new Response(crateJson)
    if (url.pathname === '/api/v4/user') return Response.json({ id: 7, name: url.host, username: 'researcher' })
    if (url.pathname === '/api/v4/groups') return Response.json([group(url.host)], { headers: { 'X-Next-Page': '' } })
    const kind = url.pathname.startsWith('/api/v4/groups/') ? 'Organisation' : url.searchParams.has('search') ? 'Matching' : 'Featured'
    return projectResponse([project({ name: `${url.host} ${kind} ARC`, web_url: `https://${url.host}/plants/study` })])
  })
  vi.stubGlobal('fetch', fetchCall)
})

function expectSkeleton(label: string) {
  expect(screen.getByRole('status', { name: label })).toBeVisible()
  expect(screen.getByRole('status', { name: label }).querySelector('[data-component="SkeletonBox"]')).toBeInTheDocument()
}

describe('multiple GitLab instances', () => {
  it.each(dataHubCollection.supported)('loads discovery, search and organisation repositories from $name', async instance => {
    const host = new URL(instance.url).host
    const pendingTop = deferred<Response>()
    const pendingGroups = deferred<Response>()
    const pendingSearch = deferred<Response>()
    const pendingProjects = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation((input, init) => {
      const url = requestUrl(input)
      if (url.host !== host) return transport(input, init)
      if (url.pathname === '/api/v4/groups') return pendingGroups.promise
      if (url.pathname.startsWith('/api/v4/groups/')) return pendingProjects.promise
      return url.searchParams.has('search') ? pendingSearch.promise : pendingTop.promise
    })
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('combobox', { name: 'GitLab instance' })).toHaveValue(defaultDataHub.id)
    expect(screen.getByText(defaultDataHub.description!)).toBeVisible()
    await screen.findByRole('link', { name: 'git.nfdi4plants.org Featured ARC' })
    await user.type(screen.getByRole('textbox', { name: 'Search term' }), 'plants{Enter}')
    await screen.findByRole('link', { name: 'git.nfdi4plants.org Matching ARC' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Organisation' }), '10')
    await screen.findByRole('link', { name: 'git.nfdi4plants.org Organisation ARC' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'GitLab instance' }), instance.id)
    expectSkeleton('Loading most-starred ARCs…')
    expectSkeleton('Loading organisations…')
    expect(screen.queryByRole('link', { name: /git.nfdi4plants.org .* ARC/ })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Search term' })).toHaveValue('')
    expect(screen.queryByText(defaultDataHub.description!)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: `Explore ${instance.name} ↗` })).toHaveAttribute('href', `${instance.url}explore/projects/active`)

    await act(async () => {
      pendingTop.resolve(projectResponse([project({ name: `${host} Featured ARC` })]))
      pendingGroups.resolve(Response.json([group(host)], { headers: { 'X-Next-Page': '' } }))
    })
    expect(await screen.findByRole('link', { name: `${host} Featured ARC` })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Organisation' })).toHaveValue('')
    await user.type(screen.getByRole('textbox', { name: 'Search term' }), 'plants{Enter}')
    expectSkeleton('Searching ARCs…')
    await act(async () => pendingSearch.resolve(projectResponse([project({ name: `${host} Matching ARC` })])))
    expect(await screen.findByRole('link', { name: `${host} Matching ARC` })).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Organisation' }), '10')
    expectSkeleton('Loading organisation repositories…')
    await act(async () => pendingProjects.resolve(projectResponse([project({ name: `${host} Organisation ARC` })])))
    expect(await screen.findByRole('link', { name: `${host} Organisation ARC` })).toBeVisible()

    const calls = fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === host)
    expect(calls.map(call => requestUrl(call[0]).pathname)).toEqual([
      '/api/v4/projects', '/api/v4/groups', '/api/v4/projects', '/api/v4/groups/10/projects',
    ])
    expect(requestUrl(calls[2][0]).searchParams.get('search')).toBe('plants')
    expect(calls.every(call => requestToken(call[1]) === null)).toBe(true)

    fetchCall.mockImplementation(transport)
    await user.click(screen.getByRole('link', { name: `${host} Organisation ARC` }))
    expect(await screen.findByText(`Arc Dashboard: ${host} Organisation ARC -`)).toBeVisible()
    const download = fetchCall.mock.calls.find(call => requestUrl(call[0]).pathname.includes('/packages/generic/'))!
    expect(String(download[0])).toBe(`${instance.url}api/v4/projects/1/packages/generic/isa_arc_json/0.0.1/arc-ro-crate-metadata.json`)
    expect(requestToken(download[1])).toBeNull()
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', project().web_url)
    expect(await screen.findByText('ARC viewer')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('combobox', { name: 'GitLab instance' })).toHaveValue(defaultDataHub.id)
    expect(await screen.findByRole('link', { name: 'git.nfdi4plants.org Featured ARC' })).toBeVisible()
  })

  it.each([
    { instance: defaultDataHub, selection: 'Featured' },
    { instance: dataHubCollection.supported[0], selection: 'Matching' },
  ])('downloads a selected $selection ARC using the token for $instance.name', async ({ instance, selection }) => {
    const tokens = { [defaultDataHub.id]: 'official-token', [dataHubCollection.supported[0].id]: 'microbe-token' }
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens))
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Account menu' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'GitLab instance' }), instance.id)
    if (selection === 'Matching') await user.type(screen.getByRole('textbox', { name: 'Search term' }), 'plants{Enter}')
    await user.click(await screen.findByRole('link', { name: `${new URL(instance.url).host} ${selection} ARC` }))

    expect(await screen.findByText(`Arc Dashboard: ${new URL(instance.url).host} ${selection} ARC -`)).toBeVisible()
    const download = fetchCall.mock.calls.find(call => requestUrl(call[0]).pathname.includes('/packages/generic/'))!
    expect(String(download[0])).toBe(`${instance.url.replace(/\/+$/, '')}/api/v4/projects/1/packages/generic/isa_arc_json/0.0.1/arc-ro-crate-metadata.json`)
    expect(requestToken(download[1])).toBe(tokens[instance.id])
    expect(requestUrl(download[0]).search).toBe('')
  })

  it('cancels an unfinished authenticated ARC download when the user logs out', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ [defaultDataHub.id]: 'saved-token' }))
    const pending = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    fetchCall.mockImplementation((input, init) => {
      if (!requestUrl(input).pathname.includes('/packages/generic/')) return transport(input, init)
      return requestToken(init) ? pending.promise : Promise.resolve(new Response('Forbidden', { status: 403 }))
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('button', { name: 'Account menu' })
    await user.click(await screen.findByRole('link', { name: 'git.nfdi4plants.org Featured ARC' }))
    expect(screen.getByText('Loading…')).toBeVisible()

    const download = fetchCall.mock.calls.find(call => requestUrl(call[0]).pathname.includes('/packages/generic/'))!
    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(download[1]?.signal?.aborted).toBe(true)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load ARC.')
    await act(async () => pending.resolve(new Response(crateJson)))
    expect(screen.queryByText(/Arc Dashboard:/)).not.toBeInTheDocument()
    expect(screen.queryByText('ARC viewer')).not.toBeInTheDocument()
  })

  it('retires pending requests when users switch instances and ignores late results', async () => {
    const pending = deferred<Response>()
    const transport = fetchCall.getMockImplementation()!
    const previousHost = new URL(defaultDataHub.url).host
    fetchCall.mockImplementation((input, init) => requestUrl(input).host === previousHost ? pending.promise : transport(input, init))
    const user = userEvent.setup()
    render(<App />)
    expectSkeleton('Loading most-starred ARCs…')
    await user.selectOptions(screen.getByRole('combobox', { name: 'GitLab instance' }), dataHubCollection.supported[1].id)
    expect(await screen.findByRole('link', { name: 'datahub.rz.rptu.de Featured ARC' })).toBeVisible()
    const previousCalls = fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === previousHost)
    expect(previousCalls).toHaveLength(2)
    expect(previousCalls.every(call => call[1]?.signal?.aborted)).toBe(true)
    await act(async () => pending.resolve(projectResponse([project({ name: 'Previous instance ARC' })])))
    expect(screen.queryByRole('link', { name: 'Previous instance ARC' })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'datahub.rz.rptu.de/plants' })).toBeInTheDocument()
  })

  it('keeps the neighbouring login unchanged and uses it only for its own instance', async () => {
    const instance = dataHubCollection.supported[0]
    const host = new URL(instance.url).host
    const officialHost = new URL(defaultDataHub.url).host
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Login' }))
    await user.type(screen.getByLabelText('Personal access token'), 'official-token{Enter}')
    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeVisible()
    expect(JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)!)).toEqual({ [defaultDataHub.id]: 'official-token' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'GitLab instance' }), instance.id)
    await screen.findByRole('link', { name: `${host} Featured ARC` })
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeVisible()
    const accountMenu = await openAccountMenu(user)
    expect(accountMenu.getByText(officialHost)).toBeVisible()
    await user.keyboard('{Escape}')
    expect(JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY)!)).toEqual({ [defaultDataHub.id]: 'official-token' })
    expect(screen.getByText('Find public research contexts by name, path, or description.')).toBeVisible()
    expect(fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === host).every(call => requestToken(call[1]) === null)).toBe(true)
    expect(fetchCall.mock.calls.filter(call => requestUrl(call[0]).host === host).every(call => !requestUrl(call[0]).searchParams.has('all_available'))).toBe(true)
    await user.type(screen.getByRole('textbox', { name: 'Search term' }), 'plants{Enter}')
    expect(await screen.findByRole('link', { name: `${host} Matching ARC` })).toBeVisible()
    const searchCall = fetchCall.mock.calls.find(call => requestUrl(call[0]).host === host && requestUrl(call[0]).searchParams.has('search'))!
    expect(requestToken(searchCall[1])).toBeNull()
    expect(requestUrl(searchCall[0]).searchParams.get('visibility')).toBe('public')

    await user.selectOptions(screen.getByRole('combobox', { name: 'GitLab instance' }), defaultDataHub.id)
    expect(await screen.findByRole('button', { name: 'Account menu' })).toBeVisible()
    await waitFor(() => expect(fetchCall.mock.calls.some(call => requestUrl(call[0]).host === officialHost
      && requestUrl(call[0]).searchParams.get('all_available') === 'false'
      && requestToken(call[1]) === 'official-token')).toBe(true))
    const userCalls = fetchCall.mock.calls.filter(call => requestUrl(call[0]).pathname === '/api/v4/user')
    expect(userCalls).toHaveLength(1)
    expect(requestUrl(userCalls[0][0]).host).toBe(officialHost)
    expect(fetchCall.mock.calls.every(call => requestToken(call[1]) !== 'official-token' || requestUrl(call[0]).host === officialHost)).toBe(true)
    await waitFor(() => expect(within(screen.getByRole('combobox', { name: 'Organisation' })).getByRole('group', { name: 'Your organisations' })).toBeInTheDocument())
    const menu = await openAccountMenu(user)
    await user.click(menu.getByRole('button', { name: 'Logout' }))
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
  })
})
