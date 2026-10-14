import Phaser from 'phaser'
import type { KillerInfo } from '../../contracts/combat'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { RunContext } from './context'
import { deathText, isPhantomKill } from './deathText'
import { addEndButtons } from './endScreen'
import { addText, overlayView } from './ui'

// The headline of a phantom kill flickers like the monster did.
const FLICKER_MS = 110
const FLICKER_ALPHAS = [1, 0.35, 0.9, 0.5, 1, 1, 0.25, 0.7]

export class DeathScene extends Phaser.Scene {
  private readonly ctx: RunContext

  constructor(ctx: RunContext) {
    super(SCENE.death)
    this.ctx = ctx
  }

  create(data: { killer: KillerInfo }) {
    const director = this.ctx.director
    const { headline, detail } = deathText(data.killer, director?.plan ?? null)
    const dim = this.add.rectangle(0, 0, 1, 1, PALETTE.outline, 0.72).setOrigin(0, 0)
    const title = addText(this, 'The run is over', 10, { color: PALETTE.yellow, bold: true }).setOrigin(0.5)
    const main = addText(this, headline, 13, { bold: true, align: 'center' }).setOrigin(0.5, 0)
    const sub = addText(this, detail, 8, { align: 'center' }).setOrigin(0.5, 0)
    if (isPhantomKill(data.killer)) {
      let step = 0
      this.time.addEvent({ delay: FLICKER_MS, loop: true, callback: () => main.setAlpha(FLICKER_ALPHAS[++step % FLICKER_ALPHAS.length]) })
    }
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
