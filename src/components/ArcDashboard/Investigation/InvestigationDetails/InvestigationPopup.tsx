import { BaseStyles } from '@primer/react'
import { ThemeProvider } from '@primer/react/next'
import { createRoot, type Root } from 'react-dom/client'
import type { InvestigationMetadata } from '../types'
import { InvestigationDetails } from './InvestigationDetails'

let popupRoot: Root | undefined

export function openInvestigationPopup(metadata: InvestigationMetadata) {
  const popup = window.open('', 'arc-investigation-popup', 'width=1400,height=900,resizable=yes,scrollbars=yes')
  if (!popup) {
    window.alert('Please allow popups to open the investigation details.')
    return
  }

  popupRoot?.unmount()
  popup.document.open()
  popup.document.write('<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body></body></html>')
  popup.document.close()
  popup.document.title = metadata.title || 'Investigation Details'

  // Include both Vite's development styles and the production stylesheet links.
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((stylesheet) => {
    popup.document.head.appendChild(stylesheet.cloneNode(true))
  })

  const container = popup.document.createElement('main')
  container.style.padding = '24px'
  popup.document.body.appendChild(container)
  const root = createRoot(container)
  popupRoot = root
  root.render(
    <ThemeProvider>
      <BaseStyles>
        <h1>{metadata.title || 'Investigation Details'}</h1>
        <InvestigationDetails metadata={metadata} showFullDescription />
      </BaseStyles>
    </ThemeProvider>,
  )
  popup.addEventListener('pagehide', () => {
    root.unmount()
    if (popupRoot === root) popupRoot = undefined
  }, { once: true })
  popup.focus()
}
