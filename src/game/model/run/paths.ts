import type { StartCandidate } from '../../contracts/run'
import type { ProvenanceIndex } from '../../../arc/provenance/types'

export const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// Longest path length in steps from every node to an output, found by a memoised walk over the
// consuming rows. A step back to a node that is still being walked (a cycle) adds nothing.
// Ignoring that step keeps the table consistent: every node with a positive length has an
// output whose length is exactly one less, so a walk along the table always reaches 0.
export function longestPaths(index: ProvenanceIndex): Map<string, number> {
  const longest = new Map<string, number>()
  const visiting = new Set<string>()

  const walk = (id: string): number => {
    const known = longest.get(id)
    if (known !== undefined) return known
    visiting.add(id)
    let best = 0
    for (const rowId of index.consumedBy.get(id) ?? []) {
      const row = index.rowById.get(rowId)
      if (!row) continue
      for (const output of row.outputs) {
        if (output === id || visiting.has(output)) continue
        best = Math.max(best, 1 + walk(output))
      }
    }
    visiting.delete(id)
    longest.set(id, best)
    return best
  }

  for (const node of index.nodes) walk(node.id)
  return longest
}

// Inputs are the nodes no row produces.
export function startCandidatesFrom(index: ProvenanceIndex, longest: Map<string, number>): StartCandidate[] {
  return index.nodes
    .filter((node) => (index.producedBy.get(node.id)?.length ?? 0) === 0)
    .map((node) => ({ nodeId: node.id, pathLength: longest.get(node.id) ?? 0 }))
    .filter((candidate) => candidate.pathLength >= 1)
    .sort((a, b) => b.pathLength - a.pathLength || compareText(a.nodeId, b.nodeId))
}

// The first ceil(20 %) candidates, plus every candidate tied with the last one taken.
// The list is sorted, so ties are always adjacent. n / 5 avoids the float error of 0.2 * n.
export function topCandidates(candidates: StartCandidate[]): StartCandidate[] {
  if (candidates.length === 0) return []
  const cutoff = candidates[Math.ceil(candidates.length / 5) - 1].pathLength
  return candidates.filter((candidate) => candidate.pathLength >= cutoff)
}
