import { MetadataList } from '../Primitive Components'
import type { NamedEntity } from '../types'

export function NamedEntityList({ title, items }: { title: 'Assays' | 'Studies' | 'Runs' | 'Workflows'; items: NamedEntity[] }) {
  return (
    <MetadataList
      title={title}
      items={items}
      getKey={(item) => item.identifier}
      renderItem={(item) => item.name}
      showHeading={false}
      emptyText={`No ${title.toLowerCase()} in this ARC.`}
      listClassName="named-entity-list"
    />
  )
}
