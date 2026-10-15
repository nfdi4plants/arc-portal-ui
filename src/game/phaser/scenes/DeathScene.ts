import Phaser from 'phaser'
import type { KillerInfo } from '../../contracts/combat'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { RunContext } from './context'
import { deathText, isPhantomKill } from './deathText'
import { addEndButtons } from './endScreen'
import { RECAP_SIDE_MIN_WIDTH, RunRecapPanel } from './RunRecapPanel'
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
    const recap = director ? new RunRecapPanel(this, director.levelHistory, director.build) : null
    overlayView(this, (view) => {
      const { width: w, height: h } = view
      dim.setSize(w, h)
      // Wide views put the text in a left column and the run recap beside it, above the buttons.
      const side = recap !== null && w >= RECAP_SIDE_MIN_WIDTH
      const columnW = side ? w * 0.4 : w
      const x = columnW / 2 + (side ? 4 : 0)
      main.setWordWrapWidth(columnW * (side ? 0.9 : 0.8))
      sub.setWordWrapWidth(columnW * (side ? 0.88 : 0.7))
      const block = 14 + main.height + 8 + sub.height
      const top = side ? Math.max(10, (h - 40 - block) / 2) : h * 0.24
      title.setPosition(x, top)
      main.setPosition(x, top + 14)
      sub.setPosition(x, main.y + main.height + 8)
      if (side) {
        placeButtons(w / 2, h - 20)
        recap.layout(view, { x: columnW + 8, y: 10, w: w - columnW - 16, h: h - 46 }, { x: 0, y: 0 })
        return
      }
      const buttonsY = Math.min(Math.max(sub.y + sub.height + 24, h * 0.66), h - 52)
      placeButtons(w / 2, buttonsY)
      recap?.layout(view, null, { x: w / 2, y: buttonsY + 26 })
    })
    if (director) this.ctx.emit({ type: 'died', killer: data.killer, plan: director.plan, level: director.build.level })
  }
}
