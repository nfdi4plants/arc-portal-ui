import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { RunContext } from './context'
import { addEndButtons } from './endScreen'
import { addText, overlayView } from './ui'

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export class VictoryScene extends Phaser.Scene {
  private readonly ctx: RunContext

  constructor(ctx: RunContext) {
    super(SCENE.victory)
    this.ctx = ctx
  }

  create() {
    const director = this.ctx.director
    if (!director) return
    const { plan, build, elapsedMs } = director
    const annotations = plan.segments.reduce((sum, segment) => sum + segment.annotations.length, 0)

    const dim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.92).setOrigin(0, 0)
    const title = addText(this, 'Victory', 18, { color: PALETTE.yellow, bold: true }).setOrigin(0.5, 0)
    const subtitle = addText(this, `The ARC ${plan.arcTitle} is walked from input to output.`, 8, { align: 'center' }).setOrigin(0.5, 0)
    const stats = addText(this, `Time ${formatTime(elapsedMs)}   ·   Level ${build.level}   ·   Annotations met ${annotations}`, 9, { bold: true }).setOrigin(0.5, 0)
    const bars = this.add.graphics()
    const labels = plan.segments.map((segment) => addText(this, segment.processName, 7).setOrigin(1, 0.5))
    const placeButtons = addEndButtons(this, this.ctx)

    overlayView(this, ({ width: w, height: h }) => {
      dim.setSize(w, h)
      title.setPosition(w / 2, h * 0.08)
      subtitle.setPosition(w / 2, title.y + 24).setWordWrapWidth(w * 0.8)
      stats.setPosition(w / 2, subtitle.y + subtitle.height + 8)
      // One bar per segment, its length the segment's annotation quality.
      const top = stats.y + 22
      const buttonsY = h - 28
      const row = Math.min(12, (buttonsY - 20 - top) / Math.max(1, labels.length))
      const labelRight = w * 0.42
      const barW = w * 0.4
      bars.clear()
      plan.segments.forEach((segment, i) => {
        const y = top + i * row
        labels[i].setPosition(labelRight - 6, y + row / 2).setFontSize(Math.max(5, Math.min(7, row * 0.7)))
        bars.fillStyle(PALETTE.outline, 0.6).fillRect(labelRight, y + row * 0.2, barW, row * 0.6)
        bars.fillStyle(PALETTE.teal, 1).fillRect(labelRight, y + row * 0.2, barW * segment.quality, row * 0.6)
      })
      placeButtons(w / 2, buttonsY)
    })
    this.ctx.emit({ type: 'victory', plan, level: build.level, timeMs: elapsedMs })
  }
}
