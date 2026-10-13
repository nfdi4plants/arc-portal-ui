import { useCallback, useMemo, useState } from 'react'
import { datasetGraph, lineage, processDetail, processGraph, processGroups } from '../../../../arc/provenance/queries'
import type { ProvenanceIndex } from '../../../../arc/provenance/types'
import { GraphCanvas } from '../GraphCanvas'
import { Legend, type ProvenanceView } from './Legend'
import styles from './ProvenanceExplorer.module.css'
import {
  datasetsToCanvas,
  detailToCanvas,
  groupsToCanvas,
  limitLineage,
  lineageToCanvas,
  processesToCanvas,
  type CanvasGraph,
} from './toCanvas'

interface Navigation {
  view: ProvenanceView
  selectedDataset?: string
  selectedProcess?: string
  selectedGroup?: string
  selectedNode?: string
}

interface Crumb {
  label: string
  view: ProvenanceView
}

const VIEWS: ProvenanceView[] = ['datasets', 'processes', 'groups', 'detail', 'lineage']

const QUERY_NAMES: Record<ProvenanceView, string> = {
  datasets: 'datasetGraph(index)',
  processes: 'processGraph(index, datasetId)',
  groups: 'processGroups(index, processKey)',
  detail: 'processDetail(index, groupId)',
  lineage: 'lineage(index, nodeId)',
}

// Only these views can come up empty. A group always has a member and a lineage always contains its own node.
const NOTHING_TO_SHOW: Partial<Record<ProvenanceView, string>> = {
  datasets: 'This ARC has no datasets.',
  processes: 'This dataset has no annotated processes.',
  groups: 'This process has no inputs or outputs.',
}

const START: Navigation = { view: 'datasets' }

const CRUMB_MAX_LENGTH = 28

// Returns to an earlier view and drops the selections that belong to the deeper ones.
function backTo(nav: Navigation, view: ProvenanceView): Navigation {
  const depth = VIEWS.indexOf(view)
  return {
    view,
    selectedDataset: depth >= 1 ? nav.selectedDataset : undefined,
    selectedProcess: depth >= 2 ? nav.selectedProcess : undefined,
    selectedGroup: depth >= 3 ? nav.selectedGroup : undefined,
    selectedNode: depth >= 4 ? nav.selectedNode : undefined,
  }
}

function Breadcrumbs({ crumbs, onNavigate }: { crumbs: Crumb[]; onNavigate: (view: ProvenanceView) => void }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className={styles.crumbs}>
        {crumbs.map(({ label, view }, index) => {
          const shown = label.length > CRUMB_MAX_LENGTH ? `${label.slice(0, CRUMB_MAX_LENGTH - 1)}…` : label
          const title = shown === label ? undefined : label
          return (
            <li key={view} className={styles.crumb}>
              {index > 0 && (
                <span className={styles.separator} aria-hidden="true">
                  &gt;
                </span>
              )}
              {index === crumbs.length - 1 ? (
                <span className={styles.crumbCurrent} aria-current="page" title={title}>
                  {shown}
                </span>
              ) : (
                <button type="button" className={styles.crumbButton} title={title} onClick={() => onNavigate(view)}>
                  {shown}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

const focusElement = (element: HTMLElement | null) => element?.focus()

// The index comes ready-built from the parent. The explorer runs the queries itself, one per level.
// The parent box must have a height. The card fills it and the graph scrolls inside the card.
export function ProvenanceExplorer({ index }: { index: ProvenanceIndex }) {
  const [nav, setNav] = useState<Navigation>(START)
  // After the first navigation, whatever replaces the view takes focus, because the clicked node
  // or crumb is gone.
  const [navigated, setNavigated] = useState(false)
  // A new index is another ARC, so the selection of the old one must not outlive it. React lets a
  // component reset state while it renders, so nothing of the old selection is drawn.
  // The parent keeps the index identity stable while the ARC stays the same.
  const [seenIndex, setSeenIndex] = useState(index)
  if (seenIndex !== index) {
    setSeenIndex(index)
    setNav(START)
    setNavigated(false)
  }
  const navigate = useCallback((next: Navigation | ((current: Navigation) => Navigation)) => {
    setNavigated(true)
    setNav(next)
  }, [])
  const { view, selectedDataset, selectedProcess, selectedGroup, selectedNode } = nav

  // A level is only computed while its selection is active. The queries return undefined for an id
  // the index does not have.
  const datasets = useMemo(() => datasetGraph(index), [index])
  const processes = useMemo(
    () => (view === 'processes' && selectedDataset !== undefined ? processGraph(index, selectedDataset) : undefined),
    [index, view, selectedDataset],
  )
  const groups = useMemo(
    () => (selectedProcess !== undefined ? processGroups(index, selectedProcess) : undefined),
    [index, selectedProcess],
  )
  const detail = useMemo(
    () => (selectedGroup !== undefined ? processDetail(index, selectedGroup) : undefined),
    [index, selectedGroup],
  )
  const limitedLineage = useMemo(() => {
    const graph = selectedNode !== undefined ? lineage(index, selectedNode) : undefined
    return graph ? limitLineage(graph) : undefined
  }, [index, selectedNode])

  const handleNodeClick = useCallback(
    (id: string) => {
      switch (view) {
        case 'datasets':
          navigate({ view: 'processes', selectedDataset: id })
          break
        case 'processes': {
          const process = processes?.nodes.find((node) => node.key === id)
          navigate({
            view: 'groups',
            selectedDataset: process?.external ? process.datasetId : selectedDataset,
            selectedProcess: id,
          })
          break
        }
        case 'groups':
          navigate({ ...nav, view: 'detail', selectedGroup: id })
          break
        case 'detail':
          navigate({ ...nav, view: 'lineage', selectedNode: id })
          break
        case 'lineage':
          navigate({ ...nav, selectedNode: id })
          break
      }
    },
    [nav, view, processes, selectedDataset, navigate],
  )

  // The canvas input of the current view. It is null when the index has no result for the selection.
  const canvas = useMemo((): (CanvasGraph & { centerNodeId?: string; ariaLabel: string }) | null => {
    switch (view) {
      case 'datasets':
        return { ...datasetsToCanvas(datasets), ariaLabel: 'Dataset provenance graph' }
      case 'processes':
        return processes ? { ...processesToCanvas(processes), ariaLabel: 'Process provenance graph' } : null
      case 'groups':
        return groups
          ? { ...groupsToCanvas(groups), ariaLabel: `Input groups and output groups of ${groups.process.name}` }
          : null
      case 'detail':
        return detail
          ? {
              ...detailToCanvas(detail),
              ariaLabel: `Nodes connected to ${detail.group.label} of ${detail.process.name}`,
            }
          : null
      case 'lineage':
        return limitedLineage
          ? {
              ...lineageToCanvas(limitedLineage.graph, selectedProcess),
              ariaLabel: `Lineage graph for ${limitedLineage.graph.nodeId}`,
            }
          : null
    }
  }, [view, datasets, processes, groups, detail, limitedLineage, selectedProcess])

  const crumbs: Crumb[] = [{ label: 'Datasets', view: 'datasets' }]
  if (selectedDataset !== undefined) {
    const dataset = datasets.nodes.find((node) => node.id === selectedDataset)
    crumbs.push({ label: dataset?.label ?? selectedDataset, view: 'processes' })
  }
  if (selectedProcess !== undefined) {
    crumbs.push({ label: groups?.process.name ?? selectedProcess, view: 'groups' })
  }
  if (selectedGroup !== undefined) {
    crumbs.push({ label: detail?.group.label ?? selectedGroup, view: 'detail' })
  }
  if (selectedNode !== undefined) {
    crumbs.push({ label: selectedNode, view: 'lineage' })
  }

  const emptyMessage =
    canvas === null
      ? 'This selection is not part of the loaded ARC.'
      : canvas.nodes.length === 0
        ? (NOTHING_TO_SHOW[view] ?? null)
        : null
  const note =
    view === 'lineage' && limitedLineage && limitedLineage.graph.nodes.length < limitedLineage.total
      ? `Showing ${limitedLineage.graph.nodes.length} of ${limitedLineage.total} nodes.`
      : null

  return (
    <section className={styles.root} aria-label="Provenance explorer">
      <header className={styles.header}>
        <Breadcrumbs crumbs={crumbs} onNavigate={(target) => navigate((current) => backTo(current, target))} />
        <code className={styles.queryName}>{QUERY_NAMES[view]}</code>
      </header>
      <div className={styles.body}>
        {note && (
          <p className={styles.note} role="status">
            {note}
          </p>
        )}
        {emptyMessage === null && canvas !== null ? (
          <div className={styles.canvas}>
            <GraphCanvas
              nodes={canvas.nodes}
              edges={canvas.edges}
              ariaLabel={canvas.ariaLabel}
              onNodeClick={handleNodeClick}
              centerNodeId={canvas.centerNodeId}
              resetKey={JSON.stringify([view, selectedDataset, selectedProcess, selectedGroup, selectedNode])}
              focusOnMount={navigated}
            />
          </div>
        ) : (
          <p className={styles.empty} tabIndex={-1} ref={navigated ? focusElement : undefined}>
            {emptyMessage}
          </p>
        )}
        {view === 'detail' && emptyMessage === null && <p className={styles.hint}>Select a node to see its lineage.</p>}
      </div>
      <div className={styles.footer}>
        <Legend view={view} />
      </div>
    </section>
  )
}
