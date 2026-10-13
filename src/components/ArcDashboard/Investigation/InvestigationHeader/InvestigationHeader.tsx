import { Heading, Label, Text } from '@primer/react'
import { ExpandableText } from '../Primitive Components'

export function InvestigationHeader(props: { identifier: string; title: string; description?: string }) {
  return (
    <header className="investigation-header">
      <Label variant="secondary">Investigation</Label>
      <Heading as="h1" className="investigation-title">
        {props.title}
      </Heading>
      <Text as="p" className="investigation-identifier">
        {props.identifier}
      </Text>
      {props.description && <ExpandableText className="investigation-description">{props.description}</ExpandableText>}
    </header>
  )
}
