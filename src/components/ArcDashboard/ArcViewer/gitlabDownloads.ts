import {formatSize, type FileSizes} from './fileSizes'
import downloadIcon from './download.svg?raw'

/** GitLab web links use the browser's GitLab login and never expose an API token. */
export function gitlabDownloadUrl(repositoryUrl: string, path: string): string {
  const repository = new URL(repositoryUrl)
  if (repository.protocol !== 'https:' || repository.username || repository.password) {
    throw new Error('A secure GitLab repository URL is required.')
  }
  const parts = path.replace(/^\.\//, '').split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid repository file path.')
  }
  repository.pathname = `${repository.pathname.replace(/\/$/, '')}/-/raw/HEAD/${parts.map(encodeURIComponent).join('/')}`
  repository.search = '?inline=false'
  repository.hash = ''
  return repository.href
}

export function directItemCount(paths: string[], folder: string): number {
  const prefix = `${folder.replace(/\/$/, '')}/`
  const children = new Set<string>()
  for (const path of paths) {
    // Match the viewer, which hides .gitkeep placeholders.
    if (!path.startsWith(prefix) || path.endsWith('.gitkeep')) continue
    const child = path.slice(prefix.length).split('/')[0]
    if (child) children.add(child)
  }
  return children.size
}

/** The embedded viewer has no download-renderer prop; enhance its existing file rows. */
export function attachGitlabDownloads(container: HTMLElement, repositoryUrl: string | undefined, paths: string[], sizes?: FileSizes, sizesLoading = false) {
  for (const table of container.querySelectorAll('table')) {
    const headers = [...table.querySelectorAll('thead th')].map(header => header.textContent?.trim())
    const downloadIndex = headers.indexOf('Download')
    const sizeIndex = headers.indexOf('File Size')
    const pathIndex = headers.indexOf('Path')
    const nameIndex = headers.indexOf('Name')
    if (downloadIndex < 0 || nameIndex < 0) continue
    table.querySelectorAll('thead th')[downloadIndex]?.classList.add('gitlab-download-heading')
    for (const row of table.querySelectorAll('tbody tr')) {
      const isFile = !!row.querySelector('[aria-label="File"]')
      if (!isFile && !row.querySelector('[aria-label="Folder"]')) continue
      const cells = row.children
      const cell = cells[downloadIndex]
      if (!cell) continue
      const nameCell = cells[nameIndex]
      const name = nameCell?.querySelector('[title]')?.getAttribute('title') ?? nameCell?.querySelector('a')?.textContent?.trim() ?? [...(nameCell?.childNodes ?? [])].filter(node => !(node.nodeType === 1 && (node as Element).matches('.folder-item-count'))).map(node => node.textContent).join('').trim()
      const pathCell = pathIndex >= 0 ? cells[pathIndex] : undefined
      let path = pathCell?.querySelector('[title]')?.getAttribute('title') ?? pathCell?.textContent?.trim()
      if (!path) {
        const candidates = new Set([...paths, ...paths.flatMap(path => path.split('/').slice(0, -1).map((_, index) => path.split('/').slice(0, index + 1).join('/')))])
        const matches = [...candidates].filter(candidate => candidate.split('/').at(-1) === name)
        if (matches.length === 1) path = matches[0]
      }
      if (!path) continue
      if (sizeIndex >= 0 && (sizes || sizesLoading)) {
        const sizeCell = cells[sizeIndex]
        const size = sizes?.get(path)
        const label = size == null ? '' : formatSize(size)
        if (sizeCell && sizeCell.textContent !== label) sizeCell.textContent = label
      }
      if (!isFile) {
        if (nameCell) {
          let badge = nameCell.querySelector<HTMLSpanElement>('.folder-item-count')
          if (!badge) {
            badge = container.ownerDocument.createElement('span')
            badge.className = 'folder-item-count'
            nameCell.append(badge)
          }
          const count = directItemCount(paths, path)
          const label = `${count} ${count === 1 ? 'item' : 'items'}`
          if (badge.textContent !== `(${label})`) badge.textContent = `(${label})`
          badge.setAttribute('aria-label', `${label}, immediate files and folders`)
        }
        continue
      }
      if (!repositoryUrl) continue
      const href = gitlabDownloadUrl(repositoryUrl, path)
      const existing = cell.querySelector<HTMLAnchorElement>('a[data-gitlab-download]')
      if (existing?.href === href) continue
      const link = container.ownerDocument.createElement('a')
      link.href = href
      // Static SVG generated from Primer's DownloadIcon.
      link.innerHTML = downloadIcon
      link.className = 'gitlab-download-icon'
      link.title = `Download ${path}`
      link.setAttribute('aria-label', `Download ${path} from GitLab`)
      link.dataset.gitlabDownload = 'true'
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      cell.replaceChildren(link)
    }
  }
}
