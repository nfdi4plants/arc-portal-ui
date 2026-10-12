import type { ArcTable, OntologyAnnotation, Person } from '@nfdi4plants/arctrl'

// Plain view models handed to components. Nothing from arctrl leaks past the
// selectors, so primitives never depend on (mutable) arctrl objects.

export interface OntologyTerm {
  name: string
  accession?: string
  url?: string
}

export interface PersonSummary {
  key: string
  name: string
  email?: string
  affiliation?: string
  orcid?: string
  orcidUrl?: string
  roles: OntologyTerm[]
}

export interface TableSummary {
  name: string
  rowCount: number
  columnCount: number
}

// Matches compact accessions like "MS:1000490" or "NCIT:C129432".
const compactAccession = /^[A-Za-z][\w.-]*:[\w.-]+$/

export function toOntologyTerm(annotation: OntologyAnnotation | undefined): OntologyTerm | undefined {
  if (!annotation) return undefined
  const tan = annotation.TermAccessionNumber || undefined
  const isIri = tan?.startsWith('http') ?? false
  const isCompact = tan !== undefined && compactAccession.test(tan)
  // arctrl shortens known IRIs (".../obo/MS_1000031" -> "MS:1000031"). Only use that
  // when it looks right; for other values it just glues the source REF in front.
  const short = annotation.TermAccessionShort
  const accession = isCompact || (isIri && compactAccession.test(short)) ? short : tan
  // A full IRI is its own link; only compact OBO-style accessions map to an Ontobee URL.
  const url = isIri ? tan : isCompact ? annotation.TermAccessionOntobeeUrl : undefined
  const name = annotation.NameText || accession
  if (!name) return undefined
  return { name, accession, url }
}

export function toOntologyTerms(annotations: OntologyAnnotation[]): OntologyTerm[] {
  return annotations.map(toOntologyTerm).filter((term) => term !== undefined)
}

export function fullName(person: Person): string {
  return [person.FirstName, person.MidInitials, person.LastName].filter(Boolean).join(' ')
}

// arctrl fields can be empty strings rather than undefined; treat both as missing.
export function nonEmpty(value: string | undefined): string | undefined {
  return value?.trim() ? value : undefined
}

export function toPersonSummary(person: Person, index: number): PersonSummary {
  const name = fullName(person)
  const orcid = nonEmpty(person.ORCID)
  const email = nonEmpty(person.EMail)
  return {
    key: orcid ?? email ?? `${name}#${index}`,
    name: name || 'Unnamed person',
    email,
    affiliation: nonEmpty(person.Affiliation),
    orcid,
    orcidUrl: orcid ? `https://orcid.org/${orcid}` : undefined,
    roles: toOntologyTerms(person.Roles),
  }
}

export function toTableSummary(table: ArcTable): TableSummary {
  return { name: table.Name, rowCount: table.RowCount, columnCount: table.ColumnCount }
}
