import { Link } from '@primer/react'
import { MetadataList } from '../Primitive Components'
import type { NamedEntity } from '../types'

export function NamedEntityList({ title, items, onSelect }: { title: 'Assays' | 'Studies' | 'Runs' | 'Workflows'; items: NamedEntity[]; onSelect?: (item: NamedEntity) => void }) {
  return (
    <MetadataList
      title={title}
      items={items}
      getKey={(item) => item.identifier}
      renderItem={(item) => onSelect ? <Link as="button" onClick={() => onSelect(item)}>{item.name}</Link> : item.name}
      showHeading={false}
      emptyText={`No ${title.toLowerCase()} in this ARC.`}
      listClassName="named-entity-list"
    />
  )
}
