import '@primer/primitives/dist/css/functional/themes/light.css'
import '@primer/css/dist/primer.css'
import {WebViewer} from '@nfdi4plants/arc-web-view'
import {Component, useCallback, useEffect, useRef, useState, type ReactNode} from 'react'

const defaultArcUrl = `${import.meta.env.BASE_URL}arc-ro-crate-metadata.json`

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

function ExpandedWebViewer({ provideJson }: { provideJson: () => Promise<string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    // WebViewer uses a dialog below Primer's wide breakpoint (1400px).
    // It has no initial-sidebar prop, so activate its own toggle once ready.
    if (!container || initialized.current) return;
    const desktop = window.matchMedia('(min-width: 1400px)');

    const openSidebar = () => {
      if (initialized.current || !desktop.matches) return;
      const toggle = [...container.querySelectorAll<HTMLButtonElement>('button')].find((button) => {
        const label = button.getAttribute('aria-label') ??
          (button.getAttribute('aria-labelledby') ?? '').split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
        return label.trim() === 'Expand sidebar';
      });
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
  }, []);

  return <div ref={containerRef} className="viewer-content"><WebViewer jsonString={provideJson} /></div>;
}


function ArcViewer() {
  const [document, setDocument] = useState<{name: string; json: string} | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const provideJson = useCallback(async () => document?.json ?? '', [document])

  useEffect(() => {
    const controller = new AbortController()
    async function loadDefaultArc() {
      try {
        const response = await fetch(defaultArcUrl, {signal: controller.signal})
        if (!response.ok) {
          throw new Error(`Could not load the bundled ARC (HTTP ${response.status}). Please refresh the page to try again.`)
        }
        const json = validateCrate(await response.text())
        if (!controller.signal.aborted) setDocument({name: 'Project 42 / arc-ro-crate-metadata.json', json})
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
  }, [])

  return (
    <main className="arc-portal">
      <header className="portal-header">
        <div>
          <h1>ARC web viewer</h1>
          <p>Explore an Annotated Research Context and its metadata.</p>
          <a href={defaultArcUrl} download>Download source ARC JSON</a>
        </div>
      </header>
      {error && <p className="portal-error" role="alert">{error}</p>}
      {document ? (
        <section aria-label="ARC contents" className="arc-viewer">
          <ViewerErrorBoundary key={document.json}>
            <ExpandedWebViewer provideJson={provideJson} />
          </ViewerErrorBoundary>
        </section>
      ) : (
        <section className="empty-state">
          <h2>{loading ? 'Loading ARC…' : 'ARC unavailable'}</h2>
          <p>{loading ? 'Loading the ARC metadata and file view.' : 'Please refresh the page to try again.'}</p>
        </section>
      )}
    </main>
  )
}

export default ArcViewer
