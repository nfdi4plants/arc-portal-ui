# ARC portal UI

A React + TypeScript + Vite example for discovering Annotated Research Contexts
(ARCs). Every GitLab repository returned by the API is treated as an ARC; the
example does not inspect repository contents to validate ARC structure.

The UI uses [Primer React](https://primer.style/product/components/).

## Run locally

```sh
npm ci
npm run dev
```

The example in `src/App.tsx` displays the 10 most-starred public ARCs and an
independent search component. Search runs on Enter or Search button submission,
with 10 results per page and Previous/Next controls. Both sections include archived
repositories and expose loading, empty, error, and retry states.

## Reference GitLab

`src/config/gitlab.ts` exports `referenceGitLab`:

- `source`: `https://git.nfdi4plants.org`
- `exploreUrl`: `https://git.nfdi4plants.org/explore/projects/active`

The explore URL is a navigation reference. API calls use the instance source,
without the explore path. Every public API operation requires its own source
argument and does not read the reference configuration.

## GitLab API

Import the client from `src/api/gitlab/index.ts`. Shared DTOs, options, and
pagination types live in `src/types/gitlab.ts`.

```ts
import {
  getTopStarredProjects,
  searchProjects,
  listProjects,
  getProject,
  GitLabApiError,
} from './src/api/gitlab/index.ts'

// Sources can include a GitLab installation subpath or a trailing slash.
const source = 'https://another-gitlab.example/gitlab/'
const controller = new AbortController()

const featured = await getTopStarredProjects(source, {
  perPage: 10,
  signal: controller.signal,
})
const matches = await searchProjects(source, 'plant growth', {
  page: 1,
  perPage: 10,
  signal: controller.signal,
})
const activeProjects = await listProjects(source, {
  archived: false,
  visibility: 'public',
  orderBy: 'last_activity_at',
  sort: 'desc',
})
const arc = await getProject(source, 'group/subgroup/arc-name')
// Numeric IDs work too: await getProject(source, 123)

console.log(featured.items, matches.nextPage, activeProjects.items, arc.name)
```

All operations perform GET requests under `/api/v4`. Repository search uses
[GitLab's Projects API](https://docs.gitlab.com/api/projects/),
`/projects?search=…`, which matches names, paths, and descriptions on the server.
This public-search example does not use the authenticated global `/search` API.
Top-starred requests use `order_by=star_count&sort=desc&visibility=public`.
The top-starred and search helpers always request public repositories; the general
list operation supports public, internal, or private visibility.

List operations return `{ items, page, perPage, nextPage, previousPage, total,
totalPages }`. Page size must be between 1 and 100. Missing total headers yield
`null`. An exposed empty `X-Next-Page` marks the last page. If CORS hides pagination
headers, a full page enables Next; the subsequent page may be empty, with Previous
still available to return to the results.

HTTP errors throw `GitLabApiError` with an HTTP `status`. Network errors also use
that type with `status: null`; abort errors propagate unchanged. For example:

```ts
try {
  await listProjects(source)
} catch (error) {
  if (error instanceof GitLabApiError) console.error(error.status, error.message)
}
```

Request options accept an optional `fetchCall` transport, defaulting to native
`fetch`. API and App tests pass their mock transport directly; component tests
pass callbacks returning plain page data. No global fetch or module patching is
required.

Request options also accept an optional runtime `token`, sent using `PRIVATE-TOKEN`.
The example uses no token and sends no browser session credentials. Never put a
private token in committed source, a Vite environment variable, or a public bundle.

Direct browser access requires the chosen instance to allow your app origin via
CORS. Network/CORS errors are shown with retry controls. Reachability and CORS for
the reference instance should also be checked in your deployment environment.
The public top-starred endpoint was verified to return 10 projects with CORS
enabled and pagination headers exposed during development.

## Components

Each component keeps its implementation, styles, and tests under
`src/components/<component-name>/`:

- `TopStarredArcs` takes `fetchCall(signal)`, which resolves to an ARC page.
- `ArcSearch` takes `fetchCall(query, { page, perPage, signal })`, which resolves
  to an ARC page. It fetches on explicit submission, with new queries starting at
  page one. Replacing the callback retires the current search; submit again to
  use the replacement.
- `ArcList` accepts `projects` and an accessible list `label`.

The example is composed directly inside `src/App.tsx`. Small, memoized wrappers
there bind the reference source to the correct GitLab API functions. `App` also
accepts an optional native-style `fetchCall` transport for integration tests.
Keep callback identities stable (use `useCallback` when defining them in a parent)
to avoid restarting requests on unrelated renders.

A component test supplies mock data directly, without patching the API:

```tsx
const fetchCall = vi.fn().mockResolvedValue({
  items: [mockProject],
  page: 1,
  perPage: 10,
  nextPage: null,
  previousPage: null,
  total: null,
  totalPages: null,
})
render(<TopStarredArcs fetchCall={fetchCall} />)
```

Callback types live in `src/types/arc.ts`. Shared request state and
cancellation live under `src/util/`; shared types and configuration have their own
folders. Requests are canceled on replacement/unmount, and late responses cannot
overwrite current results.

## Checks

```sh
npm test             # Vitest run
npm run test:watch   # Vitest watch mode
npm run build        # TypeScript and production build
npm run lint         # Oxlint
```

Vitest and React Testing Library run in jsdom. All tests are colocated
`<file>.test.tsx` files. They receive explicit mock callbacks or transports and do
not depend on a live GitLab instance.
Shared test setup supplies jest-dom matchers, explicit cleanup, mock restoration,
and Primer's required `matchMedia` shim.

API tests cover source handling, encoding, filters, ranking, pagination, HTTP and
network errors, and cancellation. Component and App tests cover observable ARC
information, submission, pagination, retries, callback changes, stale responses,
StrictMode, and independence of the two sections.
