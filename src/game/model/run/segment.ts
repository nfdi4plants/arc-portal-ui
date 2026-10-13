import type { Annotation, ProvenanceIndex, ProvenanceRow } from '../../../arc/provenance/types'
import type { SegmentQuality, TelegraphMs } from '../../contracts/run'
import { compareText } from './paths'

// Same order as compareAnnotations in src/arc/provenance/buildIndex.ts, which is not exported.
function compareAnnotations(a: Annotation, b: Annotation): number {
  return (
    compareText(a.name, b.name) ||
    compareText(a.value ?? '', b.value ?? '') ||
    compareText(a.unit ?? '', b.unit ?? '') ||
    compareText(a.accession ?? '', b.accession ?? '') ||
    compareText(a.category, b.category)
  )
}

function annotationKey({ name, value, unit, accession, category }: Annotation): string {
  return JSON.stringify([name, value, unit, accession, category])
}

// The ISA annotations of the step fromId -> toId: the signature annotations of every row that
// links the two nodes, deduplicated and sorted. Undefined when no row links them. The row is
// the first one that does, and it supplies the process and dataset of the segment.
export function segmentAnnotations(
  index: ProvenanceIndex,
  fromId: string,
  toId: string,
): { annotations: Annotation[]; row: ProvenanceRow } | undefined {
  const rows: ProvenanceRow[] = []
  for (const rowId of index.consumedBy.get(fromId) ?? []) {
    const row = index.rowById.get(rowId)
    if (row && row.inputs.includes(fromId) && row.outputs.includes(toId)) rows.push(row)
  }
  if (rows.length === 0) return undefined

  const byKey = new Map<string, Annotation>()
  for (const row of rows) {
    const signature = index.processByKey.get(row.processKey)?.signatures.find((s) => s.rowIds.includes(row.id))
    for (const annotation of signature?.annotations ?? []) byKey.set(annotationKey(annotation), annotation)
  }
  return { annotations: [...byKey.values()].sort(compareAnnotations), row: rows[0] }
}

export const segmentQuality: SegmentQuality = (annotations) => Math.min(1, annotations.length / 8)

export const telegraphMs: TelegraphMs = (quality) => Math.round(80 + 820 * quality)
