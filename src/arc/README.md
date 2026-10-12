# ARC data store

Turns an ARC RO-Crate (`ro-crate-metadata.json`) into plain data for React components.

## Quickstart

**1. Provide an ARC once, at the app root.**

```tsx
import { useEffect, useState } from 'react'
import { ArcProvider } from './arc/ArcProvider'
import { createArcStore } from './arc/arcStore'
import { sampleSources } from './arc/sources'

export function App() {
  const [store] = useState(() => createArcStore(sampleSources[0]))
  useEffect(() => {
    void store.load()
  }, [store])

  return <ArcProvider store={store}>{/* your components */}</ArcProvider>
}
```

**2. Read data in a component with a hook.**

```tsx
import { useAssays } from '../arc/selectors/studiesAndAssays'

export function AssayList() {
  const assays = useAssays()
  if (!assays) return <p>Loading…</p>

  return (
    <ul>
      {assays.map((assay) => (
        <li key={assay.identifier}>{assay.title}</li>
      ))}
    </ul>
  )
}
```

Hooks return plain objects, or `undefined` until the ARC has loaded. See [available hooks](#available-hooks) for what exists.

**3. If no hook gives you the data you need, add a selector.**

```ts
// src/arc/selectors/workflows.ts
import type { ARC } from '@nfdi4plants/arctrl'
import { useArcSelector } from '../hooks'

export const selectWorkflowIds = (arc: ARC) => arc.Workflows.map((workflow) => workflow.Identifier)
export const useWorkflowIds = () => useArcSelector(selectWorkflowIds)
```

A selector takes the parsed ARC and returns plain data. Call arctrl's getters directly; they need no wrappers.

**Rules**

- Selectors return plain data (strings, numbers, arrays, plain objects), never arctrl objects.
- Change the ARC only through `store.mutate(...)`.
- Handle `undefined` from hooks as "not loaded yet".

That's enough to build a component. The sections below explain the details.

---

## Details

### How it works

arctrl (`@nfdi4plants/arctrl`) parses the crate into mutable class instances, so React can't detect changes by reference. The store owns the parsed ARC and notifies subscribers on every change. Selectors turn the ARC into plain objects, and hooks re-render a component only when its selected data changed.

```
ArcSource ──► ArcStore ──► selector (arc) => plain data ──► hook ──► component
(crate JSON)  (ARC + status)
ArcRegistry: one ArcStore per ArcKey (multi-ARC views)
```

| File | Contents |
| --- | --- |
| `types.ts` | `ArcKey`, `ArcSource`, `ArcStatus` |
| `sources.ts` | `urlSource()`, `sampleSources` |
| `arcStore.ts` | `createArcStore()`, `ArcStore` |
| `arcRegistry.ts` | `createArcRegistry()`, `ArcRegistry` |
| `ArcProvider.tsx` | `<ArcProvider>`, `<ArcRegistryProvider>` |
| `hooks.ts` | `useArcStore`, `useArcRegistry`, `useArcStatus`, `useArcSelector`, `useStoreSelector`, `useArcKeys` |
| `selectors/*.ts` | Pure selectors, named hooks and view-model types |

### Setup options

- Any URL serving an RO-Crate works as a source: `urlSource({ key: 'demo', label: 'Demo ARC', url: '/arcs/demo/ro-crate-metadata.json' })`.
- `load()` is idempotent, and concurrent calls share one load. `load({ force: true })` reloads.
- `store.getStatus()` returns `ArcStatus`: `idle` → `loading` → `ready`, or `error` (with `error`).
- Create stores outside render: at module scope, with `useState(() => ...)`, or in a registry.

### Loading and errors

Composite components call hooks; primitive components take plain props.

```tsx
import { Banner, Spinner } from '@primer/react'
import { useArcStatus } from '../arc/hooks'
import { useInvestigationSummary } from '../arc/selectors/investigation'

export function InvestigationHeader() {
  const status = useArcStatus()
  const summary = useInvestigationSummary()

  if (status.kind === 'error') return <Banner variant="critical" title="Could not load ARC" description={String(status.error)} />
  if (!summary) return <Spinner />

  return <InvestigationHeaderView title={summary.title} description={summary.description} studyCount={summary.counts.studies} />
}

// Primitive: plain props only
function InvestigationHeaderView(props: { title: string; description?: string; studyCount: number }) {
  return (
    <header>
      <h1>{props.title}</h1>
      {props.description && <p>{props.description}</p>}
      <span>{props.studyCount} studies</span>
    </header>
  )
}
```

### Available hooks

| Hook | Returns | File |
| --- | --- | --- |
| `useInvestigationSummary()` | `InvestigationSummary` | `selectors/investigation.ts` |
| `useContacts()` | `PersonSummary[]` | `selectors/investigation.ts` |
| `usePublications()` | `PublicationSummary[]` | `selectors/investigation.ts` |
| `useStudies()` | `StudySummary[]` | `selectors/studiesAndAssays.ts` |
| `useAssays()` | `AssaySummary[]` | `selectors/studiesAndAssays.ts` |
| `useAssay(identifier)` | `AssaySummary \| undefined` | `selectors/studiesAndAssays.ts` |
| `useAllPeople()` | `PersonWithInvolvement[]` (contacts, study contacts, assay performers merged) | `selectors/people.ts` |
| `useAnnotationColumns()` | `AnnotationColumn[]` (characteristics, parameters, factors, components across all tables) | `selectors/annotations.ts` |

All return `undefined` until the ARC is loaded. Fields are in the type definitions in each file. Shared types (`OntologyTerm`, `PersonSummary`, `TableSummary`) are in `selectors/common.ts`.

### One-off reads with `useArcSelector`

```tsx
const assayIds = useArcSelector((arc) => arc.Assays.map((assay) => assay.Identifier))
```

- A stable selector (module-level function, or `useCallback`) runs only when the ARC data changes. An inline selector also runs on every render.
- Results are compared structurally by default. An equal result keeps its previous identity and doesn't cause a re-render, even from an inline selector.
- Pass `isEqual` as the second argument only when structural comparison is wrong or too slow for your result.

### Adding an access function

1. Write a pure selector `(arc: ARC) => plain data` in `selectors/`.
2. Export a named hook next to it.
3. Test the selector against the sample crate.

```ts
// selectors/workflows.ts
import type { ARC } from '@nfdi4plants/arctrl'
import { useArcSelector } from '../hooks'
import { toOntologyTerm, type OntologyTerm } from './common'

export interface WorkflowSummary {
  identifier: string
  title: string
  type?: OntologyTerm
}

export function selectWorkflows(arc: ARC): WorkflowSummary[] {
  return arc.Workflows.map((workflow) => ({
    identifier: workflow.Identifier,
    title: workflow.Title ?? workflow.Identifier,
    type: toOntologyTerm(workflow.WorkflowType),
  }))
}

export const useWorkflows = () => useArcSelector(selectWorkflows)
```

With a parameter, take it after `arc` and wrap the selector in `useCallback` in the hook. Then it only re-runs when the ARC or the parameter changes.

```ts
export function selectWorkflow(arc: ARC, identifier: string): WorkflowSummary | undefined {
  return selectWorkflows(arc).find((workflow) => workflow.identifier === identifier)
}

export function useWorkflow(identifier: string) {
  const selector = useCallback((arc: ARC) => selectWorkflow(arc, identifier), [identifier])
  return useArcSelector(selector)
}
```

Selectors can build on other selectors:

```ts
import { selectAssays, selectStudies } from './studiesAndAssays'

export function selectTableStats(arc: ARC) {
  const tables = [...selectStudies(arc), ...selectAssays(arc)].flatMap((item) => item.tables)
  return { tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rowCount, 0) }
}
```

`selectors/common.ts` has helpers that convert arctrl objects: `toOntologyTerm`, `toOntologyTerms`, `toPersonSummary`, `toTableSummary`.

Test (`tests/arc/workflows.test.ts`, run with `npm test`):

```ts
import { ARC } from '@nfdi4plants/arctrl'
import { expect, it } from 'vitest'
import { crateJson } from '../helpers/sampleCrate'
import { selectWorkflows } from '../../src/arc/selectors/workflows'

it('lists workflows', () => {
  const arc = ARC.fromROCrateJsonString(crateJson)
  expect(selectWorkflows(arc)).toHaveLength(6)
})
```

For hook tests, `sampleCrateSource()` from the same helper file serves the sample crate without network access. See `tests/arc/hooks.test.tsx`.

### Changing data

```tsx
const store = useArcStore()
const rename = (title: string) => store.mutate((arc) => { arc.Title = title })
```

- Every selector hook re-runs after `mutate`, and a component re-renders only if its result changed.
- `mutate` returns `false` and does nothing while the ARC isn't loaded, while it's loading, or after `dispose()`.
- If `fn` throws, subscribers are still notified (partial changes show up) and the error is rethrown.
- Changing `store.getArc()` or another arctrl object directly modifies the data, but no component finds out, so they keep showing stale values.

### Multiple ARCs

```tsx
import { ArcProvider, ArcRegistryProvider } from './arc/ArcProvider'
import { createArcRegistry } from './arc/arcRegistry'
import { useArcKeys, useArcRegistry } from './arc/hooks'
import { sampleSources } from './arc/sources'

const registry = createArcRegistry()
for (const source of sampleSources) void registry.add(source).load()

function ArcList() {
  const registry = useArcRegistry()
  const keys = useArcKeys()
  return keys.map((key) => (
    <ArcProvider key={key} store={registry.get(key)!}>
      <InvestigationHeader />
    </ArcProvider>
  ))
}

export const App = () => (
  <ArcRegistryProvider registry={registry}>
    <ArcList />
  </ArcRegistryProvider>
)
```

- `add(source)` returns the existing store if the key is already registered. `remove(key)` disposes the store.
- `ArcKey` says where an ARC comes from (e.g. `git.nfdi4plants.org/group/project@main`), not its investigation identifier, which can repeat across GitLab instances.
- Without a provider per ARC, pass the store explicitly: `useStoreSelector(store, selectInvestigationSummary)`.

### Gotchas

- Returning arctrl objects (`arc.Studies`, a `Person`, ...) from a selector breaks updates. They change in place, so the equality check can't tell old from new.
- During `load({ force: true })` and after a failed reload, the previous ARC stays readable. Selector hooks keep returning data while the status is `loading` or `error`.
- Study → assay links aren't available. arctrl's RO-Crate export drops them, so no selector exposes them.
- arctrl getters return `string | undefined` for optional text (`Title`, `Description`, ...), so fall back explicitly: `study.Title ?? study.Identifier`. Collections (`Studies`, `Assays`, `Contacts`, `Tables`, ...) are plain arrays.
- `useArcStore()` and `useArcRegistry()` throw outside their provider.
