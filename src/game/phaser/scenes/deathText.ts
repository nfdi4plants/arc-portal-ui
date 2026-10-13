import type { KillerInfo } from '../../contracts/combat'
import type { RunPlan, Segment } from '../../contracts/run'
import { plural } from './plural'

const ANNOTATE_HINT = 'Annotate this step in your ARC to give the next mage a fighting chance.'

// A fully annotated step already gives the longest warnings, so asking for more would read oddly.
function stepDetail(segment: Segment, warner: string): string {
  const n = segment.annotations.length
  if (segment.quality >= 1) {
    return `${segment.processName} has ${plural(n, 'annotation')}, so ${warner} warns before every big attack. Watch for the warnings and try again.`
  }
  const count = n > 0 && segment.quality < 0.5 ? `only ${plural(n, 'annotation')}` : plural(n, 'annotation')
  return `${segment.processName} has ${count}. ${ANNOTATE_HINT}`
}

// Headline and explanation for the death screen. The plan names the step of a final boss phase,
// which the killer info only holds as an index.
export function deathText(killer: KillerInfo, plan: RunPlan | null): { headline: string; detail: string } {
  switch (killer.kind) {
    case 'mob':
      return { headline: `Slain by ${killer.label}`, detail: '' }
    case 'boss':
      return { headline: `Defeated by ${killer.spec.label}`, detail: stepDetail(killer.segment, 'this boss') }
    case 'finalBoss': {
      const segment = plan?.segments[killer.phase]
      return {
        headline: `The ARC ${killer.title} stood firm in phase ${killer.phase + 1}.`,
        detail: segment ? stepDetail(segment, 'this phase') : '',
      }
    }
    case 'hazard':
      return { headline: killer.label, detail: '' }
  }
}
