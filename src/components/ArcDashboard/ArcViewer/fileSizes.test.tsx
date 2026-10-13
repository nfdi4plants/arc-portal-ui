import {expect, it, vi, afterEach} from 'vitest'
import {aggregateSizes, formatSize, loadFileSizes} from './fileSizes'

afterEach(() => vi.unstubAllGlobals())

it('sums nested files once and keeps empty folders at zero', () => {
  const sizes = aggregateSizes(new Map([['a/one', 10], ['a/nested/two', 20]]), ['a', 'a/nested', 'empty'])
  expect(sizes.get('a')).toBe(30)
  expect(sizes.get('a/nested')).toBe(20)
  expect(sizes.get('empty')).toBe(0)
  expect(formatSize(0)).toBe('0 B')
  expect(formatSize(1024)).toBe('1.0 KiB')
})

it('does not present partial folder totals as complete', () => {
  expect(aggregateSizes(new Map([['a/one', 10], ['a/two', null]]), ['a']).get('a')).toBeNull()
})

it('loads raw sizes using HEAD and includes LFS resolution without downloading bodies', async () => {
  const fetchCall = vi.fn(async (_url: string, options?: RequestInit) => options?.method === 'HEAD'
    ? new Response(null, {headers: {'Content-Length': '2048'}})
    : Response.json([{type: 'tree', path: 'data'}, {type: 'blob', path: 'data/file.bin'}]))
  vi.stubGlobal('fetch', fetchCall)
  const sizes = await loadFileSizes('https://git.nfdi4plants.org/group/arc', new AbortController().signal)
  expect(sizes.get('data')).toBe(2048)
  expect(fetchCall.mock.calls[1][0]).toContain('/files/data%2Ffile.bin/raw?ref=HEAD&lfs=true')
  expect(fetchCall.mock.calls[1][1]?.method).toBe('HEAD')
})

it('reports individual sizes before the folder total is complete', async () => {
  let finishSecond!: (response: Response) => void
  const second = new Promise<Response>(resolve => { finishSecond = resolve })
  vi.stubGlobal('fetch', vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method !== 'HEAD') return Response.json([
      {type: 'tree', path: 'data'},
      {type: 'blob', path: 'data/first'},
      {type: 'blob', path: 'data/second'},
    ])
    return url.includes('second') ? second : new Response(null, {headers: {'Content-Length': '10'}})
  }))
  let sawPartial = false
  const result = await loadFileSizes('https://git.nfdi4plants.org/group/arc', new AbortController().signal, undefined, sizes => {
    if (sizes.has('data/first') && !sizes.has('data/second')) {
      sawPartial = true
      expect(sizes.has('data')).toBe(false)
      finishSecond(new Response(null, {headers: {'Content-Length': '20'}}))
    }
  })
  expect(sawPartial).toBe(true)
  expect(result.get('data')).toBe(30)
})
