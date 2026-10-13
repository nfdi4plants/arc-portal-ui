import type { AnnotationLabel } from '../../contracts/content'

const MAX_VALUE_LENGTH = 40

// For example "Parameter · temperature day = 22 °C". The label drops an empty value and unit.
export const annotationLabel: AnnotationLabel = ({ category, name, value, unit }) => {
  const heading = `${category.charAt(0).toUpperCase()}${category.slice(1)} · ${name}`
  if (!value) return heading
  const shown = value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…` : value
  return unit ? `${heading} = ${shown} ${unit}` : `${heading} = ${shown}`
}
