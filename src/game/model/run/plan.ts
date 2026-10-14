import type { ProvenanceIndex } from '../../../arc/provenance/types'
import { createRng } from '../../contracts/rng'
import type { ListStartCandidates, PlanRun, RunNode, Segment } from '../../contracts/run'
import { compareText, longestPaths, startCandidatesFrom, topCandidates } from './paths'
import { segmentAnnotations, segmentQuality, telegraphMs } from './segment'

export const listStartCandidates: ListStartCandidates = (index) =>
  startCandidatesFrom(index, longestPaths(index))

function runNode(index: ProvenanceIndex, id: string): RunNode {
  const node = index.nodeById.get(id)
  return { id, kind: node?.kind ?? 'data', annotations: node?.annotations ?? [] }
}

export const planRun: PlanRun = (index, arcTitle, seed) => {
  const longest = longestPaths(index)
  const candidates = startCandidatesFrom(index, longest)
  if (candidates.length === 0) return null

  const rng = createRng(seed)
  const start = rng.fork('start').pick(topCandidates(candidates))
  const pathRng = rng.fork('path')

  const nodes: RunNode[] = [runNode(index, start.nodeId)]
  const segments: Segment[] = []
  let current = start.nodeId
  for (let remaining = start.pathLength; remaining > 0; remaining--) {
    const options: { rowId: string; output: string }[] = []
    for (const rowId of index.consumedBy.get(current) ?? []) {
      for (const output of index.rowById.get(rowId)?.outputs ?? []) {
        if (output !== current && longest.get(output) === remaining - 1) options.push({ rowId, output })
      }
    }
    options.sort((a, b) => compareText(a.output, b.output))

    const { output } = pathRng.pick(options)
    const found = segmentAnnotations(index, current, output)
    if (!found) return null
    const { annotations, row } = found
    const quality = segmentQuality(annotations)
    segments.push({
      index: segments.length,
      fromNodeId: current,
      toNodeId: output,
      processKey: row.processKey,
      processName: index.processByKey.get(row.processKey)?.name ?? row.processKey,
      datasetId: row.datasetId,
      datasetKind: index.datasetById.get(row.datasetId)?.kind ?? 'run',
      annotations,
      quality,
      telegraphMs: telegraphMs(quality),
    })
    nodes.push(runNode(index, output))
    current = output
  }

  return { seed, arcTitle, nodes, segments }
}
