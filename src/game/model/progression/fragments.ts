import type { MonsterSpec } from '../../contracts/content'
import type { Rng } from '../../contracts/rng'

// Ontology Fragments, the currency of the FAIR trade store. The trader collects them to put the
// broken ontologies back together. Mobs are made from annotations, so a mob whose annotation names
// an ontology term carries a fragment more often than a free-text one. A node boss always drops a
// handful. Summoned minions drop nothing, the same as they give no XP.

export const FRAGMENT_DROP = {
  // Chance that a mob drops anything at all, with and without an ontology accession. Most
  // annotations of a well-annotated ARC have one (about 4 in 5 on the Talinum ARC), so the mix pays
  // about as much as a flat 40%.
  termChance: 0.45,
  freeTextChance: 0.25,
  // A phantom has nothing filled in, so it carries a fragment rarely and never more than one.
  phantomChance: 0.2,
  // Extra fragment chance per segment index, up to depthChanceMax.
  depthChance: 0.15,
  depthChanceMax: 0.5,
  maxPerMob: 3,
  // A node boss drops bossBase + bossPerSegment * segment index, plus 0 to bossSpread.
  bossBase: 6,
  bossPerSegment: 2,
  bossSpread: 2,
} as const

export type FragmentSource = Pick<MonsterSpec, 'size' | 'segmentIndex' | 'phantom'> & { source: { accession: string | null } }

// The chance that a mob drops anything, before its size and depth add more.
export function fragmentChance(source: FragmentSource): number {
  if (source.phantom) return FRAGMENT_DROP.phantomChance
  return source.source.accession ? FRAGMENT_DROP.termChance : FRAGMENT_DROP.freeTextChance
}

// 0 to 3 fragments. One, one more for a large mob and maybe one more deeper down the path.
export function mobFragmentDrop(source: FragmentSource, rng: Rng): number {
  if (!rng.chance(fragmentChance(source))) return 0
  if (source.phantom) return 1
  let fragments = 1
  if (source.size === 'large') fragments += 1
  if (rng.chance(Math.min(FRAGMENT_DROP.depthChanceMax, FRAGMENT_DROP.depthChance * source.segmentIndex))) fragments += 1
  return Math.min(FRAGMENT_DROP.maxPerMob, fragments)
}

export function bossFragmentDrop(segmentIndex: number, rng: Rng): number {
  return FRAGMENT_DROP.bossBase + FRAGMENT_DROP.bossPerSegment * segmentIndex + rng.int(0, FRAGMENT_DROP.bossSpread)
}
