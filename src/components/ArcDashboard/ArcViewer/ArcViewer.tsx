import {ARC} from '@nfdi4plants/arctrl'
import {loadFileSizes, type FileSizes} from './fileSizes'
import {attachGitlabDownloads} from './gitlabDownloads'
import {navigateToFolder} from './navigateToFolder'
import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import {WebViewer} from '@nfdi4plants/arc-web-view'
import {Component, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react'
import { PopupDashletModeContext } from '../../PopupDashlet/PopupDashletContext'
import './arcViewer.css'

const defaultArcUrl = `${import.meta.env.BASE_URL}sample-arcs/facultative-cam-in-talinum/ro-crate-metadata.json`

function validateCrate(json: string) {
  const parsed: unknown = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object' || !('@graph' in parsed) || !Array.isArray(parsed['@graph'])) {
    throw new Error('The ARC metadata must contain an @graph array.')
  }
  return json
}

class ViewerErrorBoundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false}

  static getDerivedStateFromError() {
    return {failed: true}
  }

  render() {
    return this.state.failed
      ? <p role="alert">Could not display this ARC. Check the bundled ARC metadata and refresh the page.</p>
      : this.props.children
  }
}

function ExpandedWebViewer({ provideJson, repositoryUrl, json, token, folderRequest }: { provideJson: () => Promise<string>; repositoryUrl?: string; json: string; token?: string; folderRequest?: { path: string } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (containerRef.current && folderRequest) return navigateToFolder(containerRef.current, folderRequest.path)
  }, [folderRequest, json])
  const initialized = useRef(false);
  const popupMode = useContext(PopupDashletModeContext);
  const popupExpanded = popupMode === undefined ? undefined : popupMode === 'expanded';
  const paths = useMemo(() => {
    try { return Array.from(ARC.fromROCrateJsonString(json).FileSystem.Tree.ToFilePaths(true)) }
    catch { return [] } // The viewer displays parsing errors.
  }, [json])
  const [sizeResult, setSizeResult] = useState<{repository: string; sizes: FileSizes; complete: boolean; error?: string} | null>(null)
  useEffect(() => {
    if (!repositoryUrl) return
    const controller = new AbortController()
    queueMicrotask(() => { if (!controller.signal.aborted) setSizeResult(null) })
    void loadFileSizes(repositoryUrl, controller.signal, token, sizes => {
      if (!controller.signal.aborted) setSizeResult({repository: repositoryUrl, sizes, complete: false})
    }).then(sizes => {
      if (!controller.signal.aborted) setSizeResult({repository: repositoryUrl, sizes, complete: true})
    }).catch(error => {
      if (!controller.signal.aborted) setSizeResult({repository: repositoryUrl, sizes: new Map(), complete: true, error: error instanceof Error ? error.message : 'Could not load file sizes.'})
    })
    return () => controller.abort()
  }, [repositoryUrl, token])


  useEffect(() => {
    const container = containerRef.current;
    // WebViewer uses a dialog below Primer's wide breakpoint (1400px).
    // It has no initial-sidebar prop, so activate its own toggle once ready.
    if (!container) return;
    const viewerDocument = container.ownerDocument;
    const findToggle = () => [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => {
      const label = button.getAttribute('aria-label') ??
        (button.getAttribute('aria-labelledby') ?? '').split(/\s+/)
          .map((id) => viewerDocument.getElementById(id)?.textContent ?? '').join(' ');
      return label.trim() === 'Expand sidebar';
    });
    if (popupExpanded === false) {
      const toggle = findToggle();
      const pane = container.querySelector('[data-component="SplitPageLayout.Pane"]')?.closest('[data-is-hidden]');
      const sidebarDialog = container.closest('.popup-dashlet-panel')?.querySelector('.popup-dashlet-overlays [role="dialog"]');
      if (pane?.getAttribute('data-is-hidden') === 'false' || sidebarDialog) toggle?.click();
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    const desktop = (viewerDocument.defaultView ?? window).matchMedia('(min-width: 1400px)');

    const openSidebar = () => {
      if (initialized.current || !desktop.matches) return;
      const toggle = findToggle();
      if (!toggle) return;
      initialized.current = true;
      observer.disconnect();
      toggle.click();
    };
    const observer = new MutationObserver(openSidebar);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'aria-labelledby'] });
    desktop.addEventListener('change', openSidebar);
    openSidebar();
    return () => {
      observer.disconnect();
      desktop.removeEventListener('change', openSidebar);
    };
  }, [popupExpanded, popupMode]);

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const update = () => attachGitlabDownloads(container, repositoryUrl, paths, sizeResult && sizeResult.repository === repositoryUrl ? sizeResult.sizes : undefined, !!repositoryUrl && (!sizeResult || sizeResult.repository !== repositoryUrl || !sizeResult.complete))
    const observer = new MutationObserver(update)
    observer.observe(container, {childList: true, subtree: true})
    update()
    return () => observer.disconnect()
  }, [repositoryUrl, paths, sizeResult])

  return <>
    {sizeResult?.error && <p role="status">{sizeResult.error}</p>}
    <div ref={containerRef} className="viewer-content" onClick={(event) => {
      // WebViewer handles these links in React. Cancel their browser navigation,
      // which otherwise replaces Storybook's parent page via its base target.
      if ((event.target as Element).closest('a[href="#"]')) event.preventDefault()
    }}>
      <WebViewer jsonString={provideJson} />
    </div>
  </>;
}


export interface ArcViewerProps {
  folderRequest?: { path: string }
  jsonString?: string
  embedded?: boolean
  repositoryUrl?: string
  token?: string
}

function ArcViewer({ jsonString, embedded = false, repositoryUrl, token, folderRequest }: ArcViewerProps) {
  const [document, setDocument] = useState<{name: string; json: string} | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const arcJson = jsonString ?? document?.json
  const provideJson = useCallback(async () => arcJson ?? '', [arcJson])

  useEffect(() => {
    if (jsonString !== undefined) return
    const controller = new AbortController()
    async function loadDefaultArc() {
      try {
        const response = await fetch(defaultArcUrl, {signal: controller.signal})
        if (!response.ok) {
          throw new Error(`Could not load the bundled ARC (HTTP ${response.status}). Please refresh the page to try again.`)
        }
        const json = validateCrate(await response.text())
        if (!controller.signal.aborted) setDocument({name: 'Facultative CAM in Talinum / ro-crate-metadata.json', json})
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof TypeError
          ? 'The local ARC file could not be loaded. Please refresh the page to try again.'
          : cause instanceof Error ? cause.message : 'Could not load the ARC.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void loadDefaultArc()
    return () => controller.abort()
  }, [jsonString])

  const contents = (
    <>
      {!embedded && <header className="portal-header">
        <div>
          <h1>Files</h1>
        </div>
      </header>}
      {!jsonString && error && <p className="portal-error" role="alert">{error}</p>}
      {arcJson ? (
        <section aria-label="ARC contents" className="arc-viewer">
          <ViewerErrorBoundary key={arcJson}>
            <ExpandedWebViewer provideJson={provideJson} repositoryUrl={repositoryUrl} json={arcJson} token={token} folderRequest={folderRequest} />
          </ViewerErrorBoundary>
        </section>
      ) : (
        <section className="empty-state">
          <h2>{loading ? 'Loading ARC…' : 'ARC unavailable'}</h2>
          <p>{loading ? 'Loading the ARC metadata and file view.' : 'Please refresh the page to try again.'}</p>
        </section>
      )}
    </>
  )

  return embedded
    ? <div className="arc-portal arc-portal-embedded">{contents}</div>
    : <main className="arc-portal">{contents}</main>
}

export default ArcViewer
