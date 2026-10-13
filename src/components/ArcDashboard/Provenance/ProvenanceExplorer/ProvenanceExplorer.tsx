import { ActionList, ActionMenu } from '@primer/react'
import { Fragment, useCallback, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
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

const cutLabel = (label: string) =>
  label.length > CRUMB_MAX_LENGTH ? `${label.slice(0, CRUMB_MAX_LENGTH - 1)}…` : label

// The crumbs between the first one and the last two, in the narrow header. With three or fewer
// crumbs nothing collapses.
const hiddenCrumbs = (crumbs: Crumb[], narrow: boolean) => (narrow && crumbs.length > 3 ? crumbs.slice(1, -2) : [])

function HiddenCrumbsMenu({ hidden, onNavigate }: { hidden: Crumb[]; onNavigate: (view: ProvenanceView) => void }) {
  return (
    <ActionMenu>
      <ActionMenu.Anchor>
        <button
          type="button"
          className={`${styles.crumbButton} ${styles.crumbMore}`}
          aria-label={`Show ${hidden.length} more ${hidden.length === 1 ? 'level' : 'levels'}`}
        >
          …
        </button>
      </ActionMenu.Anchor>
      <ActionMenu.Overlay>
        <ActionList>
          {hidden.map(({ label, view }) => (
            <ActionList.Item key={view} onSelect={() => onNavigate(view)}>
              {cutLabel(label)}
            </ActionList.Item>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  )
}

function Separator() {
  return (
    <span className={styles.separator} aria-hidden="true">
      &gt;
    </span>
  )
}

function Breadcrumbs({
  crumbs,
  narrow,
  onNavigate,
}: {
  crumbs: Crumb[]
  narrow: boolean
  onNavigate: (view: ProvenanceView) => void
}) {
  const hidden = hiddenCrumbs(crumbs, narrow)
  const visible = hidden.length > 0 ? [crumbs[0], ...crumbs.slice(-2)] : crumbs
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.crumbs}>
        {visible.map(({ label, view }, position) => {
          const isLast = position === visible.length - 1
          const shown = cutLabel(label)
          // The last crumb of the narrow header can also be cut by the CSS, so it always carries its full text.
          const title = shown === label && !(narrow && isLast) ? undefined : label
          return (
            <Fragment key={view}>
              {position === 1 && hidden.length > 0 && (
                <li className={styles.crumb}>
                  <Separator />
                  <HiddenCrumbsMenu hidden={hidden} onNavigate={onNavigate} />
                </li>
              )}
              <li className={narrow && isLast ? `${styles.crumb} ${styles.crumbShrinking}` : styles.crumb}>
                {position > 0 && <Separator />}
                {isLast ? (
                  <span className={styles.crumbCurrent} aria-current="page" title={title}>
                    {shown}
                  </span>
                ) : (
                  <button type="button" className={styles.crumbButton} title={title} onClick={() => onNavigate(view)}>
                    {shown}
                  </button>
                )}
              </li>
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}

// An invisible copy of the full header content (all crumbs and the query name in one line). It
// draws its text with CSS content, so the page holds each label once for assistive technology.
// The outer box has the width of the header content area, and the copy inside has its natural width.
function HeaderRuler({
  crumbs,
  queryName,
  boxRef,
  fullRef,
}: {
  crumbs: Crumb[]
  queryName: string
  boxRef: RefObject<HTMLDivElement | null>
  fullRef: RefObject<HTMLDivElement | null>
}) {
  return (
    <div className={styles.rulerBox} ref={boxRef} aria-hidden="true">
      <div className={styles.ruler} ref={fullRef}>
        <div className={styles.crumbs}>
          {crumbs.map(({ label, view }, index) => (
            <span key={view} className={styles.crumb}>
              {index > 0 && <span className={styles.separator} data-text=">" />}
              <span
                className={index === crumbs.length - 1 ? styles.crumbCurrent : styles.crumbButton}
                data-text={cutLabel(label)}
              />
            </span>
          ))}
        </div>
        <span className={styles.queryName} data-text={queryName} />
      </div>
    </div>
  )
}

// The header switches to its narrow layout when the full content does not fit on one line.
// A ResizeObserver reports two widths: the header content area (the ruler box) and the natural
// width of the full content (the ruler). Both are independent of the layout on screen, because
// the header is as wide as the card and the ruler always holds the full content. The answer is
// therefore the same in either layout, so the header cannot flip back and forth. The observed
// elements keep their height in both layouts, so a layout switch does not fire the observer again.
function useNarrowHeader() {
  const boxRef = useRef<HTMLDivElement>(null)
  const fullRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  useLayoutEffect(() => {
    const box = boxRef.current
    const full = fullRef.current
    if (!box || !full) return
    let available = Infinity
    let natural = 0
    let frame = 0
    const observer = new ResizeObserver((entries) => {
      for (const { target, contentRect } of entries) {
        if (target === box) available = contentRect.width
        else natural = contentRect.width
      }
      // The switch waits for the next frame. Changing the layout inside the callback would resize
      // elements other observers already measured, and the browser reports that as a ResizeObserver loop.
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        // A fraction of a pixel counts against fitting, so rounding never pushes the full header past its line.
        setNarrow(Math.ceil(natural) > Math.floor(available))
      })
    })
    observer.observe(box)
    observer.observe(full)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])
  return { narrow, boxRef, fullRef }
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
  const { narrow, boxRef, fullRef } = useNarrowHeader()

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
        <Breadcrumbs
          crumbs={crumbs}
          narrow={narrow}
          onNavigate={(target) => navigate((current) => backTo(current, target))}
        />
        {!narrow && <code className={styles.queryName}>{QUERY_NAMES[view]}</code>}
        <HeaderRuler crumbs={crumbs} queryName={QUERY_NAMES[view]} boxRef={boxRef} fullRef={fullRef} />
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
