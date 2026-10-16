export type FileSizes = Map<string, number | null>

export function aggregateSizes(files: FileSizes, folders: string[]): FileSizes {
  const result = new Map(files)
  for (const folder of folders) {
    const children = [...files].filter(([path]) => path.startsWith(`${folder}/`))
    result.set(folder, children.some(([, size]) => size === null)
      ? null : children.reduce((total, [, size]) => total + (size ?? 0), 0))
  }
  return result
}

export function formatSize(size: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  const index = size > 0 ? Math.min(Math.floor(Math.log(size) / Math.log(1024)), units.length - 1) : 0
  return `${index ? (size / 1024 ** index).toFixed(1) : size} ${units[index]}`
}

/** Fetch headers only: never download file bodies to calculate folder totals. */
export async function loadFileSizes(repositoryUrl: string, signal: AbortSignal, token?: string, onProgress?: (sizes: FileSizes) => void): Promise<FileSizes> {
  const repository = new URL(repositoryUrl)
  const base = `${repository.origin}/api/v4/projects/${encodeURIComponent(decodeURIComponent(repository.pathname.replace(/^\//, '').replace(/\/$/, '')))}/repository`
  const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {}
  const files: string[] = []
  const folders: string[] = []
  for (let page = 1; ; page++) {
    const response = await fetch(`${base}/tree?ref=HEAD&recursive=true&per_page=100&page=${page}`, {headers, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), credentials: 'omit'})
    if (!response.ok) throw new Error(`Could not load file sizes (HTTP ${response.status}).`)
    const entries: Array<{type: string; path: string}> = await response.json()
    for (const entry of entries) {
      if (entry.type === 'blob') files.push(entry.path)
      else if (entry.type === 'tree') folders.push(entry.path)
    }
    if (entries.length < 100) break
  }
  const sizes: FileSizes = new Map()
  const reportProgress = () => {
    // A folder total is complete only once every descendant file has settled.
    const completeFolders = folders.filter(folder => files.every(path => !path.startsWith(`${folder}/`) || sizes.has(path)))
    onProgress?.(aggregateSizes(sizes, completeFolders))
  }
  reportProgress()
  let next = 0
  await Promise.all(Array.from({length: Math.min(4, files.length)}, async () => {
    while (next < files.length) {
      signal.throwIfAborted()
      const path = files[next++]
      try {
        const response = await fetch(`${base}/files/${encodeURIComponent(path)}/raw?ref=HEAD&lfs=true`, {method: 'HEAD', headers, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), credentials: 'omit'})
        // Content-Length describes the raw response, including the resolved LFS object.
        // X-Gitlab-Size can instead describe an LFS pointer, so do not use it as a fallback.
        const value = response.headers.get('content-length')
        const size = value === null ? NaN : Number(value)
        sizes.set(path, response.ok && Number.isSafeInteger(size) && size >= 0 ? size : null)
      } catch {
        signal.throwIfAborted()
        sizes.set(path, null)
      }
      signal.throwIfAborted()
      reportProgress()
    }
  }))
  return aggregateSizes(sizes, folders)
}
