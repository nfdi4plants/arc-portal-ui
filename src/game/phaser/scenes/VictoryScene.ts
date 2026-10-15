import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { RunContext } from './context'
import { addEndButtons } from './endScreen'
import { RECAP_SIDE_MIN_WIDTH, RunRecapPanel } from './RunRecapPanel'
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
    const recap = new RunRecapPanel(this, director.levelHistory, build)

    overlayView(this, (view) => {
      const { width: w, height: h } = view
      dim.setSize(w, h)
      // Wide views put the text and bars in a left column and the run recap beside it.
      const side = w >= RECAP_SIDE_MIN_WIDTH
      const columnW = side ? w * 0.42 : w
      const x = columnW / 2 + (side ? 4 : 0)
      title.setPosition(x, h * 0.05)
      subtitle.setPosition(x, title.y + 24).setWordWrapWidth(columnW * 0.86)
      stats.setPosition(x, subtitle.y + subtitle.height + 8).setWordWrapWidth(columnW * 0.92).setAlign('center')
      // One bar per segment, its length the segment's annotation quality.
      const top = stats.y + stats.height + 10
      const buttonsY = side ? h - 20 : h - 46
      const row = Math.min(12, (buttonsY - 20 - top) / Math.max(1, labels.length))
      const labelRight = (side ? 4 : 0) + columnW * 0.48
      const barW = columnW * 0.44
      bars.clear()
      plan.segments.forEach((segment, i) => {
        const y = top + i * row
        labels[i].setPosition(labelRight - 6, y + row / 2).setFontSize(Math.max(5, Math.min(7, row * 0.7)))
        bars.fillStyle(PALETTE.outline, 0.6).fillRect(labelRight, y + row * 0.2, barW, row * 0.6)
        bars.fillStyle(PALETTE.teal, 1).fillRect(labelRight, y + row * 0.2, barW * segment.quality, row * 0.6)
      })
      placeButtons(w / 2, buttonsY)
      if (side) recap.layout(view, { x: columnW + 8, y: 10, w: w - columnW - 16, h: h - 46 }, { x: 0, y: 0 })
      else recap.layout(view, null, { x: w / 2, y: buttonsY + 26 })
    })
    this.ctx.emit({ type: 'victory', plan, level: build.level, timeMs: elapsedMs })
  }
}
