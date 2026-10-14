import {expect, it} from 'vitest'
import {attachGitlabDownloads, gitlabDownloadUrl, directItemCount} from './gitlabDownloads'

it('builds a download link for a nested file in the selected project', () => {
  expect(gitlabDownloadUrl('https://git.nfdi4plants.org/lab/my-arc', 'assays/a b/results.csv'))
    .toBe('https://git.nfdi4plants.org/lab/my-arc/-/raw/HEAD/assays/a%20b/results.csv?inline=false')
})

it('adds downloads to file rows, leaves folders alone, and updates the selected project', () => {
  const container = document.createElement('div')
  container.innerHTML = `<table><thead><tr><th></th><th>Name</th><th>Path</th><th>Download</th></tr></thead><tbody>
    <tr><td><span aria-label="Folder"></span></td><th>assays</th><td>assays</td><td></td></tr>
    <tr><td><span aria-label="File"></span></td><th>data.csv</th><td><span title="assays/data.csv">assays/data.csv</span></td><td></td></tr>
  </tbody></table>`
  attachGitlabDownloads(container, 'https://git.nfdi4plants.org/lab/first', [])
  attachGitlabDownloads(container, 'https://git.nfdi4plants.org/lab/second', [])
  const links = container.querySelectorAll('a')
  expect(links).toHaveLength(1)
  expect(links[0].href).toContain('/lab/second/-/raw/HEAD/assays/data.csv')
})

it('supports narrow tables when the file name uniquely identifies its path', () => {
  const container = document.createElement('div')
  container.innerHTML = '<table><thead><tr><th></th><th>Name</th><th>Download</th></tr></thead><tbody><tr><td><span aria-label="File"></span></td><th>data.csv</th><td></td></tr></tbody></table>'
  attachGitlabDownloads(container, 'https://git.nfdi4plants.org/lab/arc', ['assays/data.csv'])
  expect(container.querySelector('a')?.href).toContain('/assays/data.csv')
})


it('counts immediate files and subfolders without counting deeper descendants', () => {
  expect(directItemCount([
    'assays/readme.md', 'assays/a/data.csv', 'assays/a/nested/file.txt',
    'assays/b/file.csv', 'assays/b/file.csv', 'assays/.gitkeep', 'studies/file.csv',
  ], 'assays')).toBe(3)
  expect(directItemCount([], 'empty')).toBe(0)
})

it.each([undefined, 'https://git.nfdi4plants.org/lab/arc'])('shows one folder count across updates with repository %s', (repositoryUrl) => {
  const container = document.createElement('div')
  container.innerHTML = '<table><thead><tr><th></th><th>Name</th><th>Path</th><th>Download</th></tr></thead><tbody><tr><td><span aria-label="Folder"></span></td><th><a href="#">assays</a></th><td>assays</td><td></td></tr></tbody></table>'
  for (let i = 0; i < 2; i++) attachGitlabDownloads(container, repositoryUrl, ['assays/a/file.csv', 'assays/readme.md'])
  expect(container.querySelectorAll('.folder-item-count')).toHaveLength(1)
  expect(container.querySelector('.folder-item-count')?.textContent).toBe('(2 items)')
})
