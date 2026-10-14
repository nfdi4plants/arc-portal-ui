import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import type { MonsterSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import { describeMonster, type DescribeColor } from '../../model/content'
import type { View } from '../view'
import { MOB_PANEL_RECT_KEY, type NormRect } from './mobInfoEvent'
import { drawScribbleBox } from './panelFrame'
import { placePanel } from './panelPlacement'
import { addText } from './ui'

const MARGIN = 8
const PAD = 8
const MAX_WIDTH = 360
const ROWS = 5
const ARROW_W = 14
const ROW_GAP = 5
const LEFT_SHARE = 0.4
// Above the pause title and buttons, which sit at depth 0 in the same scene.
const DEPTH = 100
const DIMMED_ALPHA = 0.15
const ANCHOR_GAP = 6

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

// Explains the annotation behind a mob the player hovers or clicks in the pause menu. Each row
// reads "annotation part: its value", an arrow, then the monster trait it caused, and both sides
// share a colour. The panel is not an input target, so the pause buttons below it keep their
// hover and clicks. The inspector learns where it sits from the registry. Every object is created
// once and reused for the next mob.
export class MobInfoPanel {
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly title: Phaser.GameObjects.Text
  private readonly rows: Row[]
  private readonly body: Phaser.GameObjects.Text
  private readonly hint: Phaser.GameObjects.Text
  private readonly all: Phaser.GameObjects.GameObject[]
  private view: View | null = null
  private open = false
  private pinned = false
  private dimmed = false
  private used = 0
  private anchor: NormRect = { x: 0.5, y: 0.5, w: 0, h: 0 }
  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.frame = scene.add.graphics()
    this.title = addText(scene, '', 11, { color: PALETTE.cream, bold: true })
    this.rows = Array.from({ length: ROWS }, () => ({
      left: addText(scene, '', 8, { bold: true }),
      arrow: addText(scene, '→', 10, { bold: true }),
      right: addText(scene, '', 8, { bold: true }),
    }))
    this.body = addText(scene, '', 7, { color: PALETTE.cream })
    this.hint = addText(scene, 'Click outside to close', 6, { color: PALETTE.blue })
    this.all = [this.frame, this.title, this.body, this.hint, ...this.rows.flatMap((row) => [row.left, row.arrow, row.right])]
    for (const part of this.all) (part as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth).setDepth(DEPTH)
    this.apply(false)
  }

  isOpen(): boolean {
    return this.open
  }

  isPinned(): boolean {
    return this.pinned
  }

  show(spec: MonsterSpec, segment: Segment, anchor: NormRect, pinned: boolean): void {
    this.anchor = anchor
    this.pinned = pinned
    const { title, rows, lines } = describeMonster(spec, segment)
    this.title.setText(title)
    this.used = Math.min(rows.length, ROWS)
    for (let i = 0; i < this.used; i++) {
      const color = cssHex(rowColor(rows[i].color))
      const row = this.rows[i]
      row.left.setText(`${rows[i].part}: ${rows[i].value}`).setColor(color)
      row.arrow.setColor(color)
      row.right.setText(rows[i].arrowTo).setColor(color)
    }
    this.body.setText(lines.join('\n'))
    this.open = true
    this.apply(true)
    this.layout(this.view)
  }

  hide(): void {
    if (!this.open) return
    this.open = false
    this.pinned = false
    this.apply(false)
    this.scene.registry.set(MOB_PANEL_RECT_KEY, null)
  }

  // The panel fades while the pointer is on a pause button, so the button stays readable.
  setDimmed(dimmed: boolean): void {
    if (dimmed === this.dimmed) return
    this.dimmed = dimmed
    const alpha = dimmed ? DIMMED_ALPHA : 1
    for (const part of this.all) (part as Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha).setAlpha(alpha)
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
    this.hint.setVisible(this.pinned)

    let rowsHeight = 0
    for (let i = 0; i < this.used; i++) {
      const row = this.rows[i]
      row.left.setWordWrapWidth(leftW, true)
      row.right.setWordWrapWidth(rightW, true)
      rowsHeight += Math.max(row.left.height, row.right.height) + ROW_GAP
    }
    const hintHeight = this.pinned ? this.hint.height + 6 : 0
    const height = PAD + this.title.height + 6 + rowsHeight + 4 + this.body.height + hintHeight + PAD
    const anchor = { x: this.anchor.x * view.width, y: this.anchor.y * view.height, w: this.anchor.w * view.width, h: this.anchor.h * view.height }
    const { x, y } = placePanel(anchor, width, height, view, MARGIN, ANCHOR_GAP)
    drawScribbleBox(this.frame, x, y, width, height, 3, PALETTE.navy, PALETTE.cream)
    this.title.setPosition(x + PAD, y + PAD)

    let top = y + PAD + this.title.height + 6
    for (let i = 0; i < this.used; i++) {
      const row = this.rows[i]
      row.left.setPosition(x + PAD, top)
      row.arrow.setPosition(x + PAD + leftW + 1, top - 1)
      row.right.setPosition(x + PAD + leftW + ARROW_W, top)
      top += Math.max(row.left.height, row.right.height) + ROW_GAP
    }
    this.body.setPosition(x + PAD, top + 4)
    this.hint.setPosition(x + PAD, y + height - PAD - this.hint.height)
    this.scene.registry.set(MOB_PANEL_RECT_KEY, { x: x / view.width, y: y / view.height, w: width / view.width, h: height / view.height })
  }

  private apply(visible: boolean): void {
    for (const part of [this.frame, this.title, this.body, this.hint]) part.setVisible(visible)
    for (let i = 0; i < this.rows.length; i++) {
      const shown = visible && i < this.used
      this.rows[i].left.setVisible(shown)
      this.rows[i].arrow.setVisible(shown)
      this.rows[i].right.setVisible(shown)
    }
  }
}

function rowColor(name: DescribeColor): number {
  return COLORS[name]
}

function cssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}
