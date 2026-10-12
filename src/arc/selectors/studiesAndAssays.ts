import type { ARC, ArcAssay } from '@nfdi4plants/arctrl'
import { useCallback } from 'react'
import { useArcSelector } from '../hooks'
import { toOntologyTerm, toTableSummary, type OntologyTerm, type TableSummary } from './common'

// Study <-> assay links are not exposed here on purpose: arctrl's RO-Crate
// export doesn't carry a study's registered assays, so after parsing a crate
// they are always empty even when the source ARC has them.

export interface StudySummary {
  identifier: string
  title: string
  description?: string
  contactCount: number
  tables: TableSummary[]
}

export interface AssaySummary {
  identifier: string
  title: string
  description?: string
  measurementType?: OntologyTerm
  technologyType?: OntologyTerm
  technologyPlatform?: OntologyTerm
  performerCount: number
  tables: TableSummary[]
}

export function selectStudies(arc: ARC): StudySummary[] {
  return arc.Studies.map((study) => ({
    identifier: study.Identifier,
    title: study.Title ?? study.Identifier,
    description: study.Description,
    contactCount: study.Contacts.length,
    tables: study.Tables.map(toTableSummary),
  }))
}

function toAssaySummary(assay: ArcAssay): AssaySummary {
  return {
    identifier: assay.Identifier,
    title: assay.Title ?? assay.Identifier,
    description: assay.Description,
    measurementType: toOntologyTerm(assay.MeasurementType),
    technologyType: toOntologyTerm(assay.TechnologyType),
    technologyPlatform: toOntologyTerm(assay.TechnologyPlatform),
    performerCount: assay.Performers.length,
    tables: assay.Tables.map(toTableSummary),
  }
}

export function selectAssays(arc: ARC): AssaySummary[] {
  return arc.Assays.map(toAssaySummary)
}

export function selectAssay(arc: ARC, identifier: string): AssaySummary | undefined {
  const assay = arc.Assays.find((candidate) => candidate.Identifier === identifier)
  return assay && toAssaySummary(assay)
}

export const useStudies = () => useArcSelector(selectStudies)
export const useAssays = () => useArcSelector(selectAssays)

export function useAssay(identifier: string) {
  const selector = useCallback((arc: ARC) => selectAssay(arc, identifier), [identifier])
  return useArcSelector(selector)
}
