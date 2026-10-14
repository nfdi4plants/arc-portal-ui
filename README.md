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

Run `npm run storybook` and open **Dashboard → Main** to explore all ARC
dashboard designs in one preview. Choose **ScrollingSplitDashboard** for the
scrolling split variant, also available under **Dashboard → ScrollingSplitDashboard**.
Scrolling, Split, and Tabbed appear first and
present Graphview before Webview. The individual designs are grouped under
Dashboard, with their layout compositions in `src/storybook/dashboards`, using
the shared ARC header, investigation popup dashlets, Graphview, viewer workspace,
and dashboard frame. Each layout includes examples
with public, private, and unavailable DataHub data, using the bundled Talinum ARC.
The application uses the classic ARC dashboard.
Dashboard scroll areas use `overscroll-behavior: auto`: when a dashlet reaches
its top or bottom, scrolling continues in the surrounding dashboard or page.

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
  getTopStarredProjects, searchProjects, listProjects, getProject, getProjectCount,
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
const count = await getProjectCount(source) // Result<number>, public repositories including archives
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

`getProjectCount` and `getGroupProjectCount` return `Result<number | null>`
from one small request using `X-Total`. Counts are capped at 10,000; hidden
pagination headers leave a nonempty count unknown. Neither operation scans
project pages. Hub counts include every accessible repository; group counts
include descendants and exclude shared projects.

The API supports an explicit `fetchCall` transport for callers and tests,
defaulting to native fetch. Project search uses the
[Projects API](https://docs.gitlab.com/api/projects/), matching names, paths, and
descriptions, rather than GitLab's authenticated global search endpoint.

## Components and callbacks

Components keep implementation, styles, and tests under `src/components/`.

- `DataHubDashboard` accepts `onArcClick` and an optional test clock. Wrap it in
  `DashboardConfigurationProvider` and `AuthenticationProvider`.
- `DashboardConfigurationProvider` captures readonly hub definitions and fetch
  callbacks once per mount. Runtime tokens come from authentication separately.
- `useDataHubs` loads hub totals; `useGroups` loads accessible and member groups;
  `useGroupProjectCount` runs inside My groups rows; `useProjectsPage` loads only
  the selected hub or group's current page.
- `TopStarredArcs` accepts `FetchArcs`; `ArcSearch` accepts `SearchArcs`. Both
  resolve to `Result<ArcPage>`; options include `page`, `perPage`, and `signal`.
- `OrganisationBrowser` accepts `fetchPublicGroups(signal)`, nullable
  `fetchMembershipGroups(signal)`, and `fetchGroupProjects(groupId, options)`.
- `ArcList` renders projects with an accessible list label.
- `AuthenticationProvider` shares session and login actions. The navbar remains
  available while initial saved logins settle, before the dashboard mounts.
  Later session changes refresh only resources belonging to that hub.

The project table defaults to the official hub and requests 25 rows per page.
Search and sorting run on the server; recent activity filtering is available
for hub browsing. Group browsing includes subgroups. Contributor and commit
lookups are not part of dashboard loading.

All groups provides local search and paging, with favorites persisted in this
browser under `arc-portal-favorite-groups`. It never requests group counts.
The Groups card uses a Primer Select to switch lists and CounterLabels for member
group repository counts. Favorites stay first without sorting by count.
My groups retains its mounted count rows through searches and list changes.
Update explicitly refreshes loaded resources; unrelated renders remain idle.

Tests inject successful, delayed, or failed Results through the configuration
provider. `useResult` and `useProjectPage` share cancellation and retry logic.

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
