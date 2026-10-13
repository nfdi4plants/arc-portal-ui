import { Text } from '@primer/react'
import { ExpandableSection } from '../Primitive Components'
import type { NamedEntity } from '../types'

export function ExpandableEntityList(props: { title: string; entities: NamedEntity[] }) {
  return (
    <ExpandableSection title={props.title} count={props.entities.length}>
      {props.entities.length > 0 ? (
        <ul className="entity-list-items">
          {props.entities.map((entity) => (
            <li key={entity.identifier}>
              <Text as="span">{entity.name}</Text>
              {entity.name !== entity.identifier && <small>{entity.identifier}</small>}
            </li>
          ))}
        </ul>
      ) : (
        <Text as="p" className="empty-state">
          No {props.title.toLowerCase()} in this ARC.
        </Text>
      )}
    </ExpandableSection>
  )
}
