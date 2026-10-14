export interface NamedEntity {
  identifier: string
  name: string
}

export interface PublicationMetadata {
  key: string
  title: string
  authors?: string
  doi?: string
  url?: string
  status?: string
}

export interface ExternalLink {
  name: string
  url: string
}

export interface ContactLocation {
  kind: 'investigation' | 'study' | 'assay' | 'run' | 'workflow'
  identifier: string
}

export interface ContactMetadata {
  key: string
  name: string
  orcidUrl?: string
  locations: ContactLocation[]
}

export interface InvestigationMetadata {
  identifier: string
  title: string
  description?: string
  publications: PublicationMetadata[]
  contacts: ContactMetadata[]
  githubLinks: ExternalLink[]
  organizations: NamedEntity[]
  assays: NamedEntity[]
  studies: NamedEntity[]
  runs: NamedEntity[]
  workflows: NamedEntity[]
}
