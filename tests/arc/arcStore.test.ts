import { describe, expect, it, vi } from 'vitest'
import { createArcRegistry } from '../../src/arc/arcRegistry'
import { createArcStore } from '../../src/arc/arcStore'
import { crateJson, sampleCrateSource } from '../helpers/sampleCrate'

// A fetch whose result the test controls and which rejects when aborted, like fetch().
function controllableFetch() {
  const calls: { resolve: (json: string) => void; reject: (error: unknown) => void; signal?: AbortSignal }[] = []
  const fetchROCrate = vi.fn(
    (signal?: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ resolve, reject, signal })
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      }),
  )
  return { fetchROCrate, calls }
}

describe('createArcStore', () => {
  it('goes idle -> loading -> ready and notifies on each step', async () => {
    const store = createArcStore(sampleCrateSource())
    const listener = vi.fn()
    store.subscribe(listener)

    expect(store.getStatus().kind).toBe('idle')
    const loading = store.load()
    expect(store.getStatus().kind).toBe('loading')
    await loading

    expect(store.getStatus().kind).toBe('ready')
    expect(store.getArc()?.Identifier).toBe('Facultative-CAM-in-Talinum')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('replaces the data snapshot only when the data changes', async () => {
    const store = createArcStore(sampleCrateSource())
    const initial = store.getSnapshot()

    const loading = store.load()
    expect(store.getSnapshot()).toBe(initial)
    await loading

    const loaded = store.getSnapshot()
    expect(loaded).not.toBe(initial)
    expect(loaded.arc).toBe(store.getArc())
  })

  it('shares one in-flight load and does not reload once ready', async () => {
    const fetchROCrate = vi.fn(() => Promise.resolve(crateJson))
    const store = createArcStore(sampleCrateSource({ fetchROCrate }))

    await Promise.all([store.load(), store.load()])
    await store.load()

    expect(fetchROCrate).toHaveBeenCalledTimes(1)
  })

  it('reports fetch failures as an error status and can retry', async () => {
    const fetchROCrate = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(crateJson)
    const store = createArcStore(sampleCrateSource({ fetchROCrate }))

    await store.load()
    const status = store.getStatus()
    expect(status.kind).toBe('error')
    expect(status.kind === 'error' && (status.error as Error).message).toBe('offline')

    await store.load()
    expect(store.getStatus().kind).toBe('ready')
  })

  it('reports unparsable crates as an error status', async () => {
    const store = createArcStore(sampleCrateSource({ fetchROCrate: () => Promise.resolve('not json') }))
    await store.load()
    expect(store.getStatus().kind).toBe('error')
    expect(store.getArc()).toBeNull()
  })

  it('lets a superseded load settle only once the forced load has finished', async () => {
    const { fetchROCrate, calls } = controllableFetch()
    const store = createArcStore(sampleCrateSource({ fetchROCrate }))
    const listener = vi.fn()
    store.subscribe(listener)

    const firstLoad = store.load()
    const secondLoad = store.load({ force: true })
    expect(calls[0].signal?.aborted).toBe(true)

    let firstSettled = false
    void firstLoad.then(() => (firstSettled = true))
    await Promise.resolve()
    await Promise.resolve()
    expect(firstSettled).toBe(false)

    calls[1].resolve(crateJson)
    await firstLoad
    await secondLoad
    expect(store.getStatus().kind).toBe('ready')
    expect(store.getArc()).not.toBeNull()
    // loading, loading (forced), ready; the aborted load adds nothing.
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('keeps the previous ARC readable when a forced reload fails', async () => {
    const fetchROCrate = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce(crateJson)
      .mockRejectedValueOnce(new Error('offline'))
    const store = createArcStore(sampleCrateSource({ fetchROCrate }))
    await store.load()
    const arc = store.getArc()

    await store.load({ force: true })
    expect(store.getStatus().kind).toBe('error')
    expect(store.getArc()).toBe(arc)
  })

  it('notifies after a mutation through the store', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const listener = vi.fn()
    store.subscribe(listener)
    const before = store.getSnapshot()

    expect(store.mutate((arc) => (arc.Title = 'Renamed'))).toBe(true)
    expect(store.getArc()?.Title).toBe('Renamed')
    expect(store.getSnapshot()).not.toBe(before)
    expect(listener).toHaveBeenCalledOnce()
  })

  it('refuses mutations before loading and while a reload runs', async () => {
    const store = createArcStore(sampleCrateSource())
    expect(store.mutate(() => {})).toBe(false)

    await store.load()
    const reload = store.load({ force: true })
    const change = vi.fn()
    expect(store.mutate(change)).toBe(false)
    expect(change).not.toHaveBeenCalled()
    await reload
    expect(store.mutate(change)).toBe(true)
  })

  it('still notifies when a mutation throws halfway', async () => {
    const store = createArcStore(sampleCrateSource())
    await store.load()
    const listener = vi.fn()
    store.subscribe(listener)

    expect(() =>
      store.mutate((arc) => {
        arc.Title = 'half done'
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('dispose during a load resets the status and makes the store inert', async () => {
    const { fetchROCrate, calls } = controllableFetch()
    const store = createArcStore(sampleCrateSource({ fetchROCrate }))
    const listener = vi.fn()
    store.subscribe(listener)

    const loading = store.load()
    store.dispose()
    await loading

    expect(calls[0].signal?.aborted).toBe(true)
    expect(store.getStatus().kind).toBe('idle')
    expect(store.getArc()).toBeNull()
    // loading, then idle from dispose
    expect(listener).toHaveBeenCalledTimes(2)

    await store.load()
    expect(fetchROCrate).toHaveBeenCalledTimes(1)
  })
})

describe('createArcRegistry', () => {
  it('creates one store per key and exposes stable key snapshots', () => {
    const registry = createArcRegistry()
    const listener = vi.fn()
    registry.subscribe(listener)

    const a = registry.add(sampleCrateSource({ key: 'a' }))
    const keysAfterA = registry.getKeys()
    expect(registry.add(sampleCrateSource({ key: 'a' }))).toBe(a)
    expect(registry.getKeys()).toBe(keysAfterA)

    registry.add(sampleCrateSource({ key: 'b' }))
    expect(registry.getKeys()).toEqual(['a', 'b'])
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('disposes stores on removal', async () => {
    const registry = createArcRegistry()
    const store = registry.add(sampleCrateSource({ key: 'a' }))
    await store.load()
    const change = vi.fn()

    registry.remove('a')
    expect(registry.get('a')).toBeUndefined()
    expect(registry.getKeys()).toEqual([])
    expect(store.mutate(change)).toBe(false)
    expect(change).not.toHaveBeenCalled()
  })
})
