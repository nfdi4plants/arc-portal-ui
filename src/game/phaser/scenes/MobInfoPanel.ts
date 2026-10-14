import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import type { MonsterSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { describeMonster, type DescribeColor } from '../../model/content'
import type { View } from '../view'
import { drawScribbleBox } from './panelFrame'
import { addText } from './ui'

const MARGIN = 8
const PAD = 8
const MAX_WIDTH = 330
const ROWS = 5
const ARROW_W = 12
const ROW_GAP = 4
const LEFT_SHARE = 0.42

const COLORS: Record<DescribeColor, number> = {
  blue: PALETTE.blue,
  teal: PALETTE.teal,
  yellow: PALETTE.yellow,
  cream: PALETTE.cream,
}

interface Row {
  left: Phaser.GameObjects.Text
  arrow: Phaser.GameObjects.Text
  right: Phaser.GameObjects.Text
}

// Explains the annotation behind a mob that the player clicked in the pause menu. The annotation
// part on the left and the trait it caused on the right share a colour. Every object is created
// once and reused for the next mob.
export class MobInfoPanel {
  private readonly swallow: Phaser.GameObjects.Rectangle
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly title: Phaser.GameObjects.Text
  private readonly rows: Row[]
  private readonly body: Phaser.GameObjects.Text
  private readonly hint: Phaser.GameObjects.Text
  private view: View | null = null
  private open = false
  private used = 0
  // Where the mob stands in the view, 0 at the top to 1 at the bottom. The panel takes the other half.
  private focusY = 0.5
  private readonly onChange: () => void

  constructor(scene: Phaser.Scene, onChange: () => void) {
    this.onChange = onChange
    this.swallow = scene.add.rectangle(0, 0, 1, 1, PALETTE.cream, 0).setOrigin(0, 0)
    this.frame = scene.add.graphics()
    this.title = addText(scene, '', 9, { color: PALETTE.cream, bold: true })
    this.rows = Array.from({ length: ROWS }, () => ({
      left: addText(scene, '', 7, { bold: true }),
      arrow: addText(scene, '→', 8, { bold: true }),
      right: addText(scene, '', 7),
    }))
    this.body = addText(scene, '', 6, { color: PALETTE.cream })
    this.hint = addText(scene, 'Click outside to close', 6, { color: PALETTE.blue })
    this.apply(false)
  }

  isOpen(): boolean {
    return this.open
  }

  show(spec: MonsterSpec, segment: Segment, focusY = 0.5): void {
    this.focusY = focusY
    const { title, rows, lines } = describeMonster(spec, segment)
    this.title.setText(title)
    this.used = Math.min(rows.length, ROWS)
    for (let i = 0; i < this.used; i++) {
      const color = COLORS[rows[i].color]
      const row = this.rows[i]
      row.left.setText(`${rows[i].part}: ${rows[i].value}`).setColor(cssHex(color))
      row.arrow.setColor(cssHex(color))
      row.right.setText(rows[i].arrowTo).setColor(cssHex(color))
    }
    this.body.setText(lines.join('\n'))
    const wasOpen = this.open
    this.open = true
    this.apply(true)
    this.layout(this.view)
    if (!wasOpen) this.onChange()
  }

  hide(): void {
    if (!this.open) return
    this.open = false
    this.apply(false)
    this.onChange()
  }

  layout(view: View | null): void {
    this.view = view
    if (!view || !this.open) return
    const width = Math.min(view.width - 2 * MARGIN, MAX_WIDTH)
    const inner = width - 2 * PAD
    const leftW = Math.floor(inner * LEFT_SHARE)
    const rightW = inner - leftW - ARROW_W
    this.title.setWordWrapWidth(inner, true)
    this.body.setWordWrapWidth(inner, true)

    let rowsHeight = 0
    for (let i = 0; i < this.used; i++) {
      const row = this.rows[i]
      row.left.setWordWrapWidth(leftW, true)
      row.right.setWordWrapWidth(rightW, true)
      rowsHeight += Math.max(row.left.height, row.right.height) + ROW_GAP
    }
    const height = PAD + this.title.height + 6 + rowsHeight + 4 + this.body.height + 6 + this.hint.height + PAD
    const x = (view.width - width) / 2
    const y = this.focusY > 0.5 ? MARGIN : Math.max(MARGIN, view.height - height - MARGIN)
    this.swallow.setPosition(x, y).setSize(width, height)
    drawScribbleBox(this.frame, x, y, width, height, 3, PALETTE.navy, PALETTE.cream)
    this.title.setPosition(x + PAD, y + PAD)

    let top = y + PAD + this.title.height + 6
    for (let i = 0; i < this.used; i++) {
      const row = this.rows[i]
      row.left.setPosition(x + PAD, top)
      row.arrow.setPosition(x + PAD + leftW + 1, top)
      row.right.setPosition(x + PAD + leftW + ARROW_W, top)
      top += Math.max(row.left.height, row.right.height) + ROW_GAP
    }
    this.body.setPosition(x + PAD, top + 4)
    this.hint.setPosition(x + PAD, y + height - PAD - this.hint.height)
    // An interactive rectangle keeps the hit area it was enabled with.
    this.swallow.removeInteractive()
    this.swallow.setInteractive()
  }

  private apply(visible: boolean): void {
    for (const part of [this.swallow, this.frame, this.title, this.body, this.hint]) part.setVisible(visible)
    for (let i = 0; i < this.rows.length; i++) {
      const shown = visible && i < this.used
      this.rows[i].left.setVisible(shown)
      this.rows[i].arrow.setVisible(shown)
      this.rows[i].right.setVisible(shown)
    }
    if (!visible) this.swallow.disableInteractive()
  }
}

function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
