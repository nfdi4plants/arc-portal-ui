import type { ARC } from '@nfdi4plants/arctrl'
import { useArcSelector } from '../hooks'
import { nonEmpty, toPersonSummary, type PersonSummary } from './common'

export interface PublicationSummary {
  key: string
  title: string
  authors?: string
  doi?: string
  doiUrl?: string
}

export interface InvestigationSummary {
  identifier: string
  title: string
  description?: string
  submissionDate?: string
  publicReleaseDate?: string
  counts: { studies: number; assays: number; workflows: number; runs: number; contacts: number }
}

export function selectInvestigationSummary(arc: ARC): InvestigationSummary {
  return {
    identifier: arc.Identifier,
    title: arc.Title ?? arc.Identifier,
    description: arc.Description,
    submissionDate: arc.SubmissionDate,
    publicReleaseDate: arc.PublicReleaseDate,
    counts: {
      studies: arc.StudyCount,
      assays: arc.AssayCount,
      workflows: arc.WorkflowCount,
      runs: arc.RunCount,
      contacts: arc.Contacts.length,
    },
  }
}

export function selectContacts(arc: ARC): PersonSummary[] {
  return arc.Contacts.map(toPersonSummary)
}

export function selectPublications(arc: ARC): PublicationSummary[] {
  return arc.Publications.map((publication, index) => {
    const doi = nonEmpty(publication.DOI)
    return {
      key: doi ?? nonEmpty(publication.PubMedID) ?? `${publication.Title}#${index}`,
      title: nonEmpty(publication.Title) ?? 'Untitled publication',
      authors: nonEmpty(publication.Authors),
      doi,
      doiUrl: doi ? `https://doi.org/${doi}` : undefined,
    }
  })
}

export const useInvestigationSummary = () => useArcSelector(selectInvestigationSummary)
export const useContacts = () => useArcSelector(selectContacts)
export const usePublications = () => useArcSelector(selectPublications)
