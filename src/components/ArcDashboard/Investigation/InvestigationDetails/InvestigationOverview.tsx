import type { InvestigationMetadata } from '../types'

export type OverviewTab = 'description' | 'contacts' | 'organizations' | 'publications' | 'assays' | 'studies'

function ListPreview({ count, firstName }: { count: number; firstName?: string }) {
  const moreCount = count - (firstName === undefined ? 0 : 1)
  return (
    <span className="investigation-overview-preview">
      {firstName !== undefined && <span>{firstName}</span>}
      {(moreCount > 0 || firstName === undefined) && <span>Show more ({moreCount})</span>}
    </span>
  )
}

export function InvestigationOverview({ metadata, onNavigate }: {
  metadata: Pick<InvestigationMetadata, 'description' | 'contacts' | 'organizations' | 'publications' | 'assays' | 'studies'>
  onNavigate: (tab: OverviewTab) => void
}) {
  return (
    <section className="investigation-overview" aria-label="ARC overview">
      <button className="investigation-overview-row" aria-label="View description" onClick={() => onNavigate('description')}>
        <span className="investigation-overview-label">Description:</span>
        <span className="investigation-overview-description">{metadata.description ?? 'No description in this ARC.'}</span>
      </button>
      <button className="investigation-overview-row" aria-label="View contacts" onClick={() => onNavigate('contacts')}>
        <span className="investigation-overview-label">Contacts:</span>
        <ListPreview count={metadata.contacts.length} firstName={metadata.contacts[0]?.name} />
      </button>
      <button className="investigation-overview-row" aria-label="View organizations" onClick={() => onNavigate('organizations')}>
        <span className="investigation-overview-label">Organizations:</span>
        <ListPreview count={metadata.organizations.length} />
      </button>
      <button className="investigation-overview-row" aria-label="View publications" onClick={() => onNavigate('publications')}>
        <span className="investigation-overview-label">Publications:</span>
        <ListPreview count={metadata.publications.length} />
      </button>
      <button className="investigation-overview-row" aria-label="View assays" onClick={() => onNavigate('assays')}>
        <span className="investigation-overview-label">Assays:</span>
        <ListPreview count={metadata.assays.length} />
      </button>
      <button className="investigation-overview-row" aria-label="View studies" onClick={() => onNavigate('studies')}>
        <span className="investigation-overview-label">Studies:</span>
        <ListPreview count={metadata.studies.length} />
      </button>
    </section>
  )
}
