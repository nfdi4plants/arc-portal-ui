import type { ARC, ArcTable } from '@nfdi4plants/arctrl'
import { useArcSelector } from '../hooks'
import { toOntologyTerm, type OntologyTerm } from './common'

// Example of a new access function arctrl doesn't offer directly: which
// characteristics, parameters, factors and components are annotated across
// all study, assay and run tables, and where each one is used.

export type AnnotationKind = 'Characteristic' | 'Parameter' | 'Factor' | 'Component'

export interface AnnotationUsage {
  kind: 'study' | 'assay' | 'run'
  identifier: string
  table: string
}

export interface AnnotationColumn {
  key: string
  kind: AnnotationKind
  term: OntologyTerm
  usedIn: AnnotationUsage[]
}

type ColumnHeader = ArcTable['Headers'][number]

function annotationKind(header: ColumnHeader): AnnotationKind | undefined {
  if (header.isCharacteristic) return 'Characteristic'
  if (header.isParameter) return 'Parameter'
  if (header.isFactor) return 'Factor'
  if (header.isComponent) return 'Component'
  return undefined
}

export function selectAnnotationColumns(arc: ARC): AnnotationColumn[] {
  const byKey = new Map<string, AnnotationColumn>()

  const visit = (tables: ArcTable[], owner: Omit<AnnotationUsage, 'table'>) => {
    for (const table of tables) {
      for (const header of table.Headers) {
        const kind = annotationKind(header)
        if (!kind) continue
        const term = toOntologyTerm(header.ToTerm())
        if (!term) continue
        const key = `${kind}:${term.accession ?? term.name}`
        let column = byKey.get(key)
        if (!column) {
          column = { key, kind, term, usedIn: [] }
          byKey.set(key, column)
        }
        column.usedIn.push({ ...owner, table: table.Name })
      }
    }
  }

  for (const study of arc.Studies) visit(study.Tables, { kind: 'study', identifier: study.Identifier })
  for (const assay of arc.Assays) visit(assay.Tables, { kind: 'assay', identifier: assay.Identifier })
  for (const run of arc.Runs) visit(run.Tables, { kind: 'run', identifier: run.Identifier })

  return [...byKey.values()]
}

export const useAnnotationColumns = () => useArcSelector(selectAnnotationColumns)
