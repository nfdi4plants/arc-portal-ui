import { Heading } from '@primer/react'
import { ExpandableEntityList } from '../ExpandableEntityList'
import { ContactList } from '../ContactList'
import { InvestigationHeader } from '../InvestigationHeader'
import { PublicationList } from '../PublicationList'
import type { InvestigationMetadata } from '../types'
import '../investigation.css'

export function InvestigationView({ metadata }: { metadata: InvestigationMetadata }) {
  return (
    <main className="investigation-page">
      <InvestigationHeader
        identifier={metadata.identifier}
        title={metadata.title}
        description={metadata.description}
        githubLinks={metadata.githubLinks}
      />

      <div className="investigation-metadata-grid">
        <PublicationList publications={metadata.publications} />
        <ContactList contacts={metadata.contacts} />
      </div>

      <section className="entities-card" aria-labelledby="arc-contents-heading">
        <Heading as="h2" id="arc-contents-heading" className="entities-heading">
          ARC contents
        </Heading>
        <ExpandableEntityList title="Assays" entities={metadata.assays} />
        <ExpandableEntityList title="Studies" entities={metadata.studies} />
        <ExpandableEntityList title="Organizations" entities={metadata.organizations} />
        <ExpandableEntityList title="Runs" entities={metadata.runs} />
        <ExpandableEntityList title="Workflows" entities={metadata.workflows} />
      </section>
    </main>
  )
}
