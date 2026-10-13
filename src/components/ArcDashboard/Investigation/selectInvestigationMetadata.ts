import type { ARC } from '@nfdi4plants/arctrl'
import { selectAllPeople } from '../../../arc/selectors/people'
import { nonEmpty } from '../../../arc/selectors/common'
import type { ExternalLink, InvestigationMetadata, NamedEntity } from './types'

const githubUrlPattern = /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+(?:\/[\w./#?=&%-]*)?/gi

function namedEntity(identifier: string, title?: string): NamedEntity {
  return { identifier, name: title?.trim() || identifier }
}

function collectGithubLinks(arc: ARC): ExternalLink[] {
  const values = [
    arc.Description,
    ...arc.Comments.flatMap((comment) => [comment.Name, comment.Value]),
    ...arc.Remarks.map((remark) => remark.Value),
    ...arc.Studies.flatMap((study) => [study.Description, ...study.Comments.flatMap((comment) => comment.Value)]),
    ...arc.Assays.flatMap((assay) => [assay.Description, ...assay.Comments.flatMap((comment) => comment.Value)]),
    ...arc.Runs.flatMap((run) => [run.Description, ...run.Comments.flatMap((comment) => comment.Value)]),
    ...arc.Workflows.flatMap((workflow) => [
      workflow.URI,
      workflow.Description,
      ...workflow.Comments.flatMap((comment) => comment.Value),
    ]),
  ]

  const urls = new Set<string>()
  for (const value of values) {
    for (const match of value?.match(githubUrlPattern) ?? []) {
      urls.add(match.replace(/[),.;]+$/, ''))
    }
  }

  return [...urls].map((url) => ({
    url,
    name: url.replace(/^https?:\/\/(?:www\.)?github\.com\//, '').replace(/\/$/, ''),
  }))
}

export function selectInvestigationMetadata(arc: ARC): InvestigationMetadata {
  const people = selectAllPeople(arc)
  const organizations = [
    ...new Set(
      people
        .map((person) => person.affiliation)
        .filter((affiliation): affiliation is string => affiliation !== undefined),
    ),
  ]
  const publications = [...arc.Publications, ...arc.Studies.flatMap((study) => study.Publications)]

  return {
    identifier: arc.Identifier,
    title: arc.Title?.trim() || arc.Identifier,
    description: arc.Description,
    publications: publications.map((publication, index) => {
      const doi = nonEmpty(publication.DOI)
      return {
        key: doi ?? nonEmpty(publication.PubMedID) ?? `${publication.Title}#${index}`,
        title: nonEmpty(publication.Title) ?? 'Untitled publication',
        authors: nonEmpty(publication.Authors),
        doi,
        url: doi ? `https://doi.org/${doi}` : undefined,
      }
    }),
    contacts: people.map((person) => {
      const investigationLocation = person.involvedIn.find((location) => location.kind === 'investigation')
      return {
        key: person.key,
        name: person.name,
        orcidUrl: person.orcidUrl,
        locations: investigationLocation ? [investigationLocation] : person.involvedIn,
      }
    }),
    githubLinks: collectGithubLinks(arc),
    assays: arc.Assays.map((assay) => namedEntity(assay.Identifier, assay.Title)),
    studies: arc.Studies.map((study) => namedEntity(study.Identifier, study.Title)),
    organizations: organizations.map((name) => ({ identifier: name, name })),
    runs: arc.Runs.map((run) => namedEntity(run.Identifier, run.Title)),
    workflows: arc.Workflows.map((workflow) => namedEntity(workflow.Identifier, workflow.Title)),
  }
}
