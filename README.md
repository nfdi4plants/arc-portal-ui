# ARC portal UI

A React + TypeScript + Vite portal for discovering Annotated Research Contexts
(ARCs), using [Primer React](https://primer.style/product/components/).
Every repository returned by GitLab is treated as an ARC; repository contents
are not inspected to validate ARC structure.

## Run locally

```sh
npm ci
npm run dev
```

The dashboard displays the 10 most-starred public ARCs, independent server-side
search, and an organisation browser. Search runs on Enter or Search submission.
Search and organisation repositories use 10 results per page with Previous/Next
controls. Archived repositories are included. Sections expose loading, empty,
error, and retry states.

## Dashboard layout stories

Run `npm run storybook` to explore the alternative ARC dashboards. The circular,
stacked, combined, split, tabbed, hub, and scrolling layouts live in
`src/storybook/dashboards` as story compositions, using the shared ARC header, investigation popup dashlets,
Graphview, viewer workspace, and dashboard frame. Each layout includes examples
with public, private, and unavailable DataHub data, using the bundled Talinum ARC.
The application uses the classic ARC dashboard.

## Optional authentication

Public browsing is available immediately. The navbar Login button opens a Primer
dialog accepting a GitLab personal access token. The generation link requests
`read_user` and `read_api` scopes. `GET /user` validates the token and returns the
name and username shown beside Logout.

Successful tokens are stored under `arc-portal-gitlab-token` in local storage;
login persists across browser sessions. Saved credentials are revalidated on
startup while public discovery continues anonymously. Unvalidated saved tokens
are never sent on discovery requests. Failed restoration preserves the saved
token for Retry saved login or Forget saved login in the dialog. Closing the
dialog cancels validation and clears its draft. Logout clears credentials and
account-specific results.

After login, search includes all accessible public, internal, and private
projects. Most-starred ARCs remain public. Login/logout cancels old requests and
clears submitted search results while preserving the draft search term.

Tokens are supplied at runtime through `PRIVATE-TOKEN` headers; they never go in
request URLs. Browser session credentials are omitted. Do not put private tokens
in committed source, Vite environment variables, or public bundles.

## Organisations

Organisations are GitLab groups, including selectable subgroups labelled by their
full path. The selector loads the complete catalogue at 100 groups per request.
Anonymous visitors see Public organisations. Signed-in visitors see:

- **Your organisations:** groups returned by authenticated `GET /groups` with
  `all_available=false`, including public, internal, and private membership groups.
- **Other public organisations:** independently fetched public groups, excluding
  membership-group IDs so a public membership group appears only once.

If membership lookup fails, public groups remain available under the neutral
Public organisations label with a separate retry action. Selecting an organisation
loads `GET /groups/:id/projects` with `include_subgroups=true`, `with_shared=false`,
and name ascending order. Changing organisation resets paging. Login/logout resets
the selection and removes previous repository results.

See the [GitLab Groups API](https://docs.gitlab.com/api/groups/) and
[Users API](https://docs.gitlab.com/api/users/).

## Reference GitLab

`src/config/gitlab.ts` exports `referenceGitLab`:

- `source`: `https://git.nfdi4plants.org`
- `exploreUrl`: `https://git.nfdi4plants.org/explore/projects/active`

App binds this source to the API callbacks. API functions themselves always
accept an explicit source and support installation subpaths and trailing slashes.
Direct browser access requires the GitLab instance to permit your app origin
through CORS. Network/CORS failures appear as errors with retry controls.

## GitLab API and Results

Import APIs from `src/api/gitlab/index.ts`. DTOs and options live in
`src/types/gitlab.ts`; Result utilities live in `src/types/result.ts`.

```ts
import {
  getTopStarredProjects, searchProjects, listProjects, getProject,
  getCurrentUser, listGroups, listAllGroups, getGroupProjects,
} from './src/api/gitlab/index.ts'

const source = 'https://another-gitlab.example/gitlab/'
const controller = new AbortController()
const featured = await getTopStarredProjects(source, { signal: controller.signal })
if (featured.success === true) {
  console.log(featured.value.items)
} else {
  console.error(featured.error)
}

// Anonymous search remains public; supplying a runtime token expands access.
const matches = await searchProjects(source, 'plant growth', { page: 1, perPage: 10 })
const active = await listProjects(source, { archived: false, visibility: 'public' })
const arc = await getProject(source, 'group/subgroup/arc-name')
const user = await getCurrentUser(source, { token: runtimeToken })
const publicGroups = await listAllGroups(source, { visibility: 'public' })
const memberships = await listAllGroups(source, { token: runtimeToken, allAvailable: false })
const groupPage = await listGroups(source, { page: 1, perPage: 100 })
const repositories = await getGroupProjects(source, 'research/plants', { page: 1, token: runtimeToken })
```

All operations resolve to `Result<T>`:

```ts
type Result<T> =
  | { success: true; value: T }
  | { success: false; error: string }
```

HTTP, transport, JSON, response-shape, argument-validation, and cancellation
failures return strings rather than throwing `GitLabApiError`. Consumers must
check `success` and access `value` or `error`. Canceled requests are ignored by
UI consumers using their abort signals. `Success`, `Failure`, `bind`, `bindAsync`,
`map`, `pipe`, and `pipeResult` follow Delight's Result utilities.

List operations return `Result<GitLabPage<T>>`, where the page contains
`items`, `page`, `perPage`, `nextPage`, `previousPage`, `total`, and `totalPages`.
Page size is between 1 and 100. Missing total headers yield `null`; an exposed
empty `X-Next-Page` marks the end. If CORS hides pagination headers, a full page
enables Next, which may lead to an empty final page with Previous still available.
`listAllGroups` accumulates every catalogue page into `Result<GitLabGroup[]>`.

The API supports an explicit `fetchCall` transport for callers and tests,
defaulting to native fetch. Project search uses the
[Projects API](https://docs.gitlab.com/api/projects/), matching names, paths, and
descriptions, rather than GitLab's authenticated global search endpoint.

## Components and callbacks

Components keep implementation, styles, and tests under `src/components/`.

- `DataHubDashboard` accepts `fetchTopStarred`, `fetchSearch`, optional `signedIn`,
  and optional `organisations` callbacks.
- `TopStarredArcs` accepts `FetchArcs`; `ArcSearch` accepts `SearchArcs`. Both
  resolve to `Result<ArcPage>`; options include `page`, `perPage`, and `signal`.
- `OrganisationBrowser` accepts `fetchPublicGroups(signal)`, nullable
  `fetchMembershipGroups(signal)`, and `fetchGroupProjects(groupId, options)`.
- `ArcList` renders projects with an accessible list label.
- `AuthenticationProvider` shares session and login actions; Navbar opens
  Authentication without routing or gating the dashboard.

App supplies memoized callbacks binding source and credentials. Keep callback
identities stable to avoid restarting requests on unrelated renders.
`useResult` and `useProjectPage` share request, cancellation, and retry logic.

Tests can supply successful, delayed, or failed Results directly:

```tsx
import { Success, Failure } from './src/types/result.ts'
import type { FetchArcs, SearchArcs } from './src/types/arc.ts'

const fetchTopStarred = vi.fn<FetchArcs>().mockResolvedValue(Success(mockPage))
const fetchSearch = vi.fn<SearchArcs>()
  .mockResolvedValueOnce(Failure('Service unavailable'))
  .mockResolvedValueOnce(Success(mockPage))
render(<DataHubDashboard fetchTopStarred={fetchTopStarred} fetchSearch={fetchSearch} />)
```

## Checks

```sh
npm test
npm run test:watch
npm run build
npm run lint
```

Vitest and React Testing Library run in jsdom with explicit mock callbacks or
transports; tests do not depend on a live GitLab instance. Shared setup supplies
jest-dom, cleanup, browser API shims required by Primer, and mock restoration.
CSS is processed so hidden responsive action copies are excluded from accessible
queries. Follow `AGENTS.md`: focus on realistic workflows and practical failures.
