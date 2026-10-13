import type { ARC } from '@nfdi4plants/arctrl'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ArcProvider } from '../../src/arc/ArcProvider'
import { createArcStore, type ArcStore } from '../../src/arc/arcStore'
import { useArcKeys, useArcSelector, useArcStatus, useArcStore, useStoreSelector } from '../../src/arc/hooks'
import { ArcRegistryProvider } from '../../src/arc/ArcProvider'
import { createArcRegistry } from '../../src/arc/arcRegistry'
import { useAssay } from '../../src/arc/selectors/studiesAndAssays'
import { crateJson, sampleCrateSource } from '../helpers/sampleCrate'

function wrapperFor(store: ArcStore) {
  return ({ children }: { children: ReactNode }) => <ArcProvider store={store}>{children}</ArcProvider>
}

const selectTitle = (arc: ARC) => arc.Title

describe('useArcStore', () => {
  it('throws outside an ArcProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useArcStore())).toThrow(/ArcProvider/)
  })
})

describe('useArcStatus', () => {
  it('follows the store through loading to ready', async () => {
    const store = createArcStore(sampleCrateSource())
    const { result } = renderHook(() => useArcStatus(), { wrapper: wrapperFor(store) })

    expect(result.current.kind).toBe('idle')
    let loading!: Promise<void>
    act(() => {
      loading = store.load()
    })
    expect(result.current.kind).toBe('loading')
    await act(() => loading)
    expect(result.current.kind).toBe('ready')
  })
})

describe('useArcSelector', () => {
  it('returns undefined until the ARC is loaded, then the selected value', async () => {
    const store = createArcStore(sampleCrateSource())
    const { result } = renderHook(() => useArcSelector(selectTitle), { wrapper: wrapperFor(store) })

    expect(result.current).toBeUndefined()
    await act(() => store.load())
    expect(result.current).toBe('Facultative CAM in Talinum triangulare')
  })

  it('keeps the same derived object across re-renders without changes', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const selectIds = vi.fn((arc: ARC) => arc.Assays.map((assay) => assay.Identifier))
    const { result, rerender } = renderHook(() => useArcSelector(selectIds), { wrapper: wrapperFor(store) })

    const first = result.current
    rerender()
    expect(result.current).toBe(first)
    expect(selectIds).toHaveBeenCalledTimes(1)
  })

  it('keeps the identity of equal results from inline selectors', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const { result, rerender } = renderHook(() => useArcSelector((arc) => arc.Assays.map((a) => a.Identifier)), {
      wrapper: wrapperFor(store),
    })

    const first = result.current
    rerender()
    rerender()
    expect(result.current).toBe(first)
  })

  it('does not recompute or re-render on status-only changes', async () => {
    const fetchROCrate = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce(crateJson)
      .mockRejectedValueOnce(new Error('offline'))
    const store = createArcStore(sampleCrateSource({ fetchROCrate }))
    await store.load()
    const selectIds = vi.fn((arc: ARC) => arc.Assays.map((assay) => assay.Identifier))
    let renders = 0
    const { result } = renderHook(
      () => {
        renders++
        return useArcSelector(selectIds)
      },
      { wrapper: wrapperFor(store) },
    )
    const first = result.current

    await act(() => store.load({ force: true }))
    expect(store.getStatus().kind).toBe('error')
    expect(result.current).toBe(first)
    expect(selectIds).toHaveBeenCalledTimes(1)
    expect(renders).toBe(1)
  })

  it('does not re-render on mutations that leave the result unchanged', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    let renders = 0
    const { result } = renderHook(
      () => {
        renders++
        return useArcSelector((arc) => arc.Assays.map((a) => a.Identifier))
      },
      { wrapper: wrapperFor(store) },
    )
    const first = result.current

    act(() => {
      store.mutate((arc) => (arc.Title = 'Unrelated change'))
    })
    expect(result.current).toBe(first)
    expect(renders).toBe(1)
  })

  it('re-runs the selector after a mutation through the store', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const { result } = renderHook(() => useArcSelector(selectTitle), { wrapper: wrapperFor(store) })

    act(() => {
      store.mutate((arc) => (arc.Title = 'Renamed'))
    })
    expect(result.current).toBe('Renamed')
  })

  it('re-runs a parameterized selector when its parameter changes', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const { result, rerender } = renderHook(({ id }) => useAssay(id), {
      wrapper: wrapperFor(store),
      initialProps: { id: 'RNASeq' },
    })

    expect(result.current?.title).toBe('mRNASeq of Talinum leaf samples')
    rerender({ id: 'MassHunter_targets' })
    expect(result.current?.title).toBe('Agilent MassHunter data analysis')
  })
})

describe('multi-ARC hooks', () => {
  it('useStoreSelector reads a given store without a provider', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const { result } = renderHook(() => useStoreSelector(store, selectTitle))
    expect(result.current).toBe('Facultative CAM in Talinum triangulare')
  })

  it('useArcKeys follows registry additions and removals', () => {
    const registry = createArcRegistry()
    const { result } = renderHook(() => useArcKeys(), {
      wrapper: ({ children }) => <ArcRegistryProvider registry={registry}>{children}</ArcRegistryProvider>,
    })

    expect(result.current).toEqual([])
    act(() => {
      registry.add(sampleCrateSource({ key: 'a' }))
      registry.add(sampleCrateSource({ key: 'b' }))
    })
    expect(result.current).toEqual(['a', 'b'])
    act(() => registry.remove('a'))
    expect(result.current).toEqual(['b'])
  })
})
