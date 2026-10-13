import { MetadataList } from '../Primitive Components'
import type { NamedEntity } from '../types'

export function OrganizationList({ organizations }: { organizations: NamedEntity[] }) {
  return (
    <MetadataList
      title="Organizations"
      items={organizations}
      getKey={(organization) => organization.identifier}
      renderItem={(organization) => organization.name}
      showHeading={false}
      description="Affiliations recorded in this ARC."
      emptyText="No organization affiliations in this ARC."
      listClassName="organization-list"
    />
  )
}
