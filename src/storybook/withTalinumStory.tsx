import type { ComponentType } from 'react'
import { TalinumStory } from './TalinumStory'

/** Use the same bundled ARC and provider lifecycle for dashboard stories. */
export function withTalinumStory<Props extends object>(Component: ComponentType<Props>) {
  const Sample = (props: Props) => <TalinumStory>{() => <Component {...props} />}</TalinumStory>
  Sample.displayName = `Sample${Component.displayName ?? Component.name}`
  return Sample
}
