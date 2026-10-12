import type { ARC, Person } from '@nfdi4plants/arctrl'
import { useArcSelector } from '../hooks'
import { fullName, nonEmpty, toOntologyTerms, toPersonSummary, type PersonSummary } from './common'

// Example of combining existing arctrl accessors: everyone mentioned anywhere
// in the ARC (investigation contacts, study contacts, assay performers),
// merged into one entry per person with where they appear.

export interface Involvement {
  kind: 'investigation' | 'study' | 'assay'
  identifier: string
}

export interface PersonWithInvolvement extends PersonSummary {
  involvedIn: Involvement[]
}

export function selectAllPeople(arc: ARC): PersonWithInvolvement[] {
  const people: PersonWithInvolvement[] = []
  // Looks entries up by "orcid:…", "email:…" and "name:…", so a person listed
  // with an ORCID in one place and only by name in another is merged.
  const index = new Map<string, PersonWithInvolvement>()

  const visit = (persons: Person[], involvement: Involvement) => {
    for (const person of persons) {
      const orcid = nonEmpty(person.ORCID)
      const email = nonEmpty(person.EMail)?.toLowerCase()
      const name = fullName(person).toLowerCase() || undefined
      const ids = [orcid && `orcid:${orcid}`, email && `email:${email}`, name && `name:${name}`].filter(
        (id) => id !== undefined,
      )

      let entry = ids.map((id) => index.get(id)).find((candidate) => candidate !== undefined)
      // Same name or email but different ORCIDs: two different people.
      if (entry && orcid && entry.orcid && entry.orcid !== orcid) entry = undefined

      if (!entry) {
        entry = { ...toPersonSummary(person, people.length), involvedIn: [] }
        people.push(entry)
      } else {
        fillMissing(entry, person)
      }
      for (const id of ids) if (!index.has(id)) index.set(id, entry)

      const seen = entry.involvedIn.some((i) => i.kind === involvement.kind && i.identifier === involvement.identifier)
      if (!seen) entry.involvedIn.push(involvement)
    }
  }

  visit(arc.Contacts, { kind: 'investigation', identifier: arc.Identifier })
  for (const study of arc.Studies) visit(study.Contacts, { kind: 'study', identifier: study.Identifier })
  for (const assay of arc.Assays) visit(assay.Performers, { kind: 'assay', identifier: assay.Identifier })

  return people
}

function fillMissing(entry: PersonWithInvolvement, person: Person) {
  const orcid = nonEmpty(person.ORCID)
  if (!entry.orcid && orcid) {
    entry.orcid = orcid
    entry.orcidUrl = `https://orcid.org/${orcid}`
  }
  entry.email ??= nonEmpty(person.EMail)
  entry.affiliation ??= nonEmpty(person.Affiliation)
  for (const role of toOntologyTerms(person.Roles)) {
    if (!entry.roles.some((existing) => existing.name === role.name)) entry.roles.push(role)
  }
}

export const useAllPeople = () => useArcSelector(selectAllPeople)
