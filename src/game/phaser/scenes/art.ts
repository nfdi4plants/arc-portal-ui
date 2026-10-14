import type { ScribbleArt } from '../../contracts/art'
import { createScribbleArt } from '../art'

let shared: ScribbleArt | null = null

// The one place the scenes get their art from. One instance for all scenes and games.
export function getArt(): ScribbleArt {
  shared ??= createScribbleArt()
  return shared
}
