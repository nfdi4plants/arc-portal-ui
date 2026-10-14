import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import { createRoot, type Root } from 'react-dom/client'
import { lazy, Suspense } from 'react'

let popupRoot: Root | undefined

export function openArcViewerPopup(jsonString: string, title: string, repositoryUrl?: string, token?: string) {
  const popup = window.open('', 'arc-viewer-popup', 'width=1400,height=900,resizable=yes,scrollbars=yes')
  if (!popup) {
    window.alert('Please allow popups to open the ARC viewer.')
    return
  }

  popupRoot?.unmount()
  popup.document.open()
  popup.document.write('<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body></body></html>')
  popup.document.close()
  popup.document.title = title

  // Include both Vite's development styles and the production stylesheet links.
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((stylesheet) => {
    popup.document.head.appendChild(stylesheet.cloneNode(true))
  })

  const container = popup.document.createElement('main')
  container.style.padding = '24px'
  popup.document.body.appendChild(container)
  const ArcViewer = lazy(() => import('./ArcViewer'))
  const root = createRoot(container)
  popupRoot = root
  root.render(
    <ThemeProvider>
      <BaseStyles>
        <h1>{title}</h1>
        <Suspense fallback={<p role="status">Loading ARC viewer…</p>}>
          <ArcViewer jsonString={jsonString} repositoryUrl={repositoryUrl} token={token} embedded />
        </Suspense>
      </BaseStyles>
    </ThemeProvider>,
  )
  popup.addEventListener('pagehide', () => {
    root.unmount()
    if (popupRoot === root) popupRoot = undefined
  }, { once: true })
  popup.focus()
}
