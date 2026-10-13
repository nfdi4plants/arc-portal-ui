import Phaser from 'phaser'
import type { KillerInfo } from '../../contracts/combat'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { RunContext } from './context'
import { addEndButtons } from './endScreen'
import { addText, overlayView, plural } from './ui'

const ANNOTATE_HINT = 'Annotate this step in your ARC to give the next mage a fighting chance.'

// Headline and explanation for the death screen.
export function deathText(killer: KillerInfo): { headline: string; detail: string } {
  switch (killer.kind) {
    case 'mob':
      return { headline: `Slain by ${killer.label}`, detail: '' }
    case 'boss': {
      const n = killer.segment.annotations.length
      const count = n > 0 && killer.segment.quality < 0.5 ? `only ${plural(n, 'annotation')}` : plural(n, 'annotation')
      return { headline: `Defeated by ${killer.spec.label}`, detail: `${killer.segment.processName} has ${count}. ${ANNOTATE_HINT}` }
    }
    case 'finalBoss':
      return { headline: `The ARC ${killer.title} stood firm in phase ${killer.phase + 1}.`, detail: '' }
    case 'hazard':
      return { headline: killer.label, detail: '' }
  }
}

export class DeathScene extends Phaser.Scene {
  private readonly ctx: RunContext

  constructor(ctx: RunContext) {
    super(SCENE.death)
    this.ctx = ctx
  }

  create(data: { killer: KillerInfo }) {
    const director = this.ctx.director
    const { headline, detail } = deathText(data.killer)
    const dim = this.add.rectangle(0, 0, 1, 1, PALETTE.outline, 0.72).setOrigin(0, 0)
    const title = addText(this, 'The run is over', 10, { color: PALETTE.yellow, bold: true }).setOrigin(0.5)
    const main = addText(this, headline, 13, { bold: true, align: 'center' }).setOrigin(0.5, 0)
    const sub = addText(this, detail, 8, { align: 'center' }).setOrigin(0.5, 0)
    const placeButtons = addEndButtons(this, this.ctx)
    overlayView(this, ({ width: w, height: h }) => {
      dim.setSize(w, h)
      main.setWordWrapWidth(w * 0.8)
      sub.setWordWrapWidth(w * 0.7)
      title.setPosition(w / 2, h * 0.24)
      main.setPosition(w / 2, h * 0.24 + 14)
      sub.setPosition(w / 2, main.y + main.height + 8)
      placeButtons(w / 2, Math.max(sub.y + sub.height + 24, h * 0.66))
    })
    if (director) this.ctx.emit({ type: 'died', killer: data.killer, plan: director.plan, level: director.build.level })
  }
}
