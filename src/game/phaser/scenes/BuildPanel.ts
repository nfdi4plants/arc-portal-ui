import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import type { PlayerBuild, WeaponSlot } from '../../contracts/progression'
import { buildSummary, type BuildSummary, type StatRow, type WeaponSummary } from '../../model/progression'
import { cssColor } from '../color'
import { addText } from './ui'

const PAPER = 0xfffdf6
const PAD = 6
const MIN_FONT = 4.5
const SLOTS: readonly WeaponSlot[] = ['light', 'heavy']
// Column widths of the stat list in font sizes, so the columns scale with the text.
const LABEL_EM = 7.8
const VALUE_EM = 8.4

export type HighlightKind = 'upgrade' | 'replace'

const HIGHLIGHT_COLOR: Record<HighlightKind, number> = { upgrade: PALETTE.teal, replace: PALETTE.blue }

interface WeaponBlock {
  title: Phaser.GameObjects.Text
  body: Phaser.GameObjects.Text
  note: Phaser.GameObjects.Text
  // Where the block sits inside the panel, for the highlight.
  y: number
  h: number
}

// The "Your build" note of the level-up screen: both weapons with their effective numbers, the stat
// list with its bonuses and the owned mechanics and legendaries as chips. Every object is created
// once. The text is laid out again only when the build or the size changes, never per frame.
export class BuildPanel {
  private readonly box: Phaser.GameObjects.Container
  private readonly paper: Phaser.GameObjects.Graphics
  private readonly marker: Phaser.GameObjects.Graphics
  private readonly icons: Phaser.GameObjects.Graphics
  private readonly header: Phaser.GameObjects.Text
  private readonly blocks: WeaponBlock[]
  private readonly labels: Phaser.GameObjects.Text
  private readonly values: Phaser.GameObjects.Text
  private readonly bonuses: Phaser.GameObjects.Text
  private readonly heads: Phaser.GameObjects.Text[]
  private readonly empty: Phaser.GameObjects.Text
  private chips: Phaser.GameObjects.Text[] = []
  private summary: BuildSummary | null = null
  private width = 0
  private maxFont = 7
  private highlight: { slot: WeaponSlot; kind: HighlightKind } | null = null
  // Height of the laid out content, so an overlay can centre itself.
  height = 0

  private readonly scene: Phaser.Scene

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.paper = scene.add.graphics()
    this.marker = scene.add.graphics()
    this.icons = scene.add.graphics()
    this.header = addText(scene, 'Your build', 9, { color: PALETTE.navy, bold: true })
    this.blocks = SLOTS.map(() => ({
      title: addText(scene, '', 7, { color: PALETTE.navy, bold: true }),
      body: addText(scene, '', 7, { color: PALETTE.navy }),
      note: addText(scene, '', 7, { color: PALETTE.outline }).setFontStyle('italic'),
      y: 0,
      h: 0,
    }))
    this.labels = addText(scene, '', 7, { color: PALETTE.navy })
    // Same style and size in all three columns, or their lines drift apart.
    this.values = addText(scene, '', 7, { color: PALETTE.navy })
    this.bonuses = addText(scene, '', 7, { color: PALETTE.outline })
    this.heads = ['Mechanics', 'Legendaries'].map((label) => addText(scene, label, 7, { color: PALETTE.navy, bold: true }))
    this.empty = addText(scene, 'No mechanics or legendaries yet.', 7, { color: PALETTE.outline }).setFontStyle('italic')
    const parts: Phaser.GameObjects.GameObject[] = [this.paper, this.marker, this.icons, this.header, this.labels, this.values, this.bonuses, this.empty, ...this.heads]
    for (const block of this.blocks) parts.push(block.title, block.body, block.note)
    this.box = scene.add.container(0, 0, parts).setVisible(false)
  }

  setVisible(visible: boolean): void {
    this.box.setVisible(visible)
  }

  setAlpha(alpha: number): void {
    this.box.setAlpha(alpha)
  }

  setBuild(build: PlayerBuild): void {
    this.summary = buildSummary(build)
    this.render()
  }

  // Places the panel and lays it out for this width. The top left corner is (x, y).
  place(x: number, y: number, width: number, maxFont: number): void {
    this.box.setPosition(x, y)
    if (width === this.width && maxFont === this.maxFont) return
    this.width = width
    this.maxFont = maxFont
    this.render()
  }

  moveTo(x: number, y: number): void {
    this.box.setPosition(x, y)
  }

  // Marks the slot an offered weapon would upgrade or replace. Null clears it.
  setHighlight(highlight: { slot: WeaponSlot; kind: HighlightKind } | null): void {
    if (this.highlight?.slot === highlight?.slot && this.highlight?.kind === highlight?.kind) return
    this.highlight = highlight
    this.drawMarker()
  }

  // The marked slot breathes. Only an alpha changes.
  pulse(clockMs: number): void {
    if (this.highlight) this.marker.setAlpha(0.55 + 0.45 * Math.sin(clockMs / 200))
  }

  private render(): void {
    const summary = this.summary
    if (!summary || this.width <= 0) return
    // The biggest text that fits the width. The height follows from it.
    let size = this.maxFont
    for (; size > MIN_FONT; size -= 0.5) if (this.arrange(summary, size)) break
    this.arrange(summary, size)
    this.drawPaper()
    this.drawIcons(size)
    this.drawMarker()
  }

  // Sizes and places everything for one font size. False when something is wider than the panel.
  private arrange(summary: BuildSummary, size: number): boolean {
    const inner = this.width - PAD * 2
    let fits = true
    let y = PAD
    this.header.setFontSize(size * 1.25).setPosition(PAD, y)
    y += this.header.height + PAD * 0.6
    const iconW = size * 1.7
    summary.weapons.forEach((weapon, i) => {
      const block = this.blocks[i]
      const textX = PAD + iconW + 3
      const textW = this.width - textX - PAD
      block.y = y
      block.title.setFontSize(size).setWordWrapWidth(textW).setText(weaponTitle(weapon)).setPosition(textX, y + 2)
      block.body.setFontSize(size).setWordWrapWidth(textW).setText(weaponLines(weapon)).setPosition(textX, block.title.y + block.title.height + 1)
      block.note.setFontSize(size - 0.5).setWordWrapWidth(textW).setText(weapon.note).setPosition(textX, block.body.y + block.body.height + 1)
      block.h = block.note.y + block.note.height + 2 - y
      y += block.h + 2
    })
    y += PAD * 0.3
    const columns = statColumns(summary.stats)
    const valueX = PAD + size * LABEL_EM
    const bonusX = valueX + size * VALUE_EM
    this.labels.setFontSize(size).setText(columns.labels).setPosition(PAD, y)
    this.values.setFontSize(size).setText(columns.values).setPosition(valueX, y)
    this.bonuses.setFontSize(size).setText(columns.bonuses).setPosition(bonusX, y)
    if (bonusX + this.bonuses.width > this.width - PAD || valueX + this.values.width > bonusX) fits = false
    y += Math.max(this.labels.height, this.values.height) + PAD
    y = this.arrangeChips(summary, size, inner, y)
    this.height = y
    return fits
  }

  // Mechanics and legendaries as small tags that wrap at the panel's edge.
  private arrangeChips(summary: BuildSummary, size: number, inner: number, top: number): number {
    const groups = [summary.mechanics, summary.legendaries]
    const total = groups[0].length + groups[1].length
    this.empty.setFontSize(size - 0.5).setVisible(total === 0).setPosition(PAD, top)
    let y = top
    if (total === 0) {
      // The headings would otherwise sit at the top left of the panel, over its title.
      for (const head of this.heads) head.setVisible(false)
      return y + this.empty.height + PAD
    }
    let used = 0
    groups.forEach((names, g) => {
      const head = this.heads[g]
      head.setVisible(names.length > 0)
      if (names.length === 0) return
      head.setFontSize(size).setPosition(PAD, y)
      y += head.height + 2
      let x = PAD
      let rowH = 0
      for (const name of names) {
        const chip = this.chipAt(used++, g === 1)
        chip.setFontSize(size - 0.5).setText(name).setVisible(true)
        if (x > PAD && x + chip.width > PAD + inner) {
          x = PAD
          y += rowH + 2
          rowH = 0
        }
        chip.setPosition(x, y)
        x += chip.width + 3
        rowH = Math.max(rowH, chip.height)
      }
      y += rowH + PAD * 0.8
    })
    for (let i = used; i < this.chips.length; i++) this.chips[i].setVisible(false)
    return y
  }

  private chipAt(index: number, legendary: boolean): Phaser.GameObjects.Text {
    let chip = this.chips[index]
    if (!chip) {
      chip = addText(this.scene, '', 6.5, { color: PALETTE.navy }).setPadding(3, 1, 3, 1)
      this.box.add(chip)
      this.chips.push(chip)
    }
    chip.setBackgroundColor(cssColor(legendary ? PALETTE.yellow : PALETTE.cream))
    return chip
  }

  // A paper note with a hand-drawn double outline, like the card details.
  private drawPaper(): void {
    const g = this.paper
    const w = this.width
    const h = this.height
    g.clear().fillStyle(PAPER, 1).fillRect(0, 0, w, h).fillStyle(PALETTE.blue, 1).fillRect(0, 0, w, 3)
    const jitter = () => (Math.random() - 0.5) * 1.6
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(pass === 0 ? 1.4 : 0.8, PALETTE.outline, pass === 0 ? 1 : 0.6)
      const corners = [0, 0, w, 0, w, h, 0, h]
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4
        g.lineBetween(corners[k * 2] + jitter(), corners[k * 2 + 1] + jitter(), corners[next * 2] + jitter(), corners[next * 2 + 1] + jitter())
      }
    }
  }

  // A mouse with the button of the slot filled: left click for light, right click for heavy.
  private drawIcons(size: number): void {
    const g = this.icons.clear()
    const w = size * 1.5
    const h = size * 2.1
    this.blocks.forEach((block, i) => {
      const x = PAD
      const y = block.y + 3
      g.lineStyle(1, PALETTE.navy, 1).strokeRoundedRect(x, y, w, h, w / 2.4)
      g.lineBetween(x, y + h * 0.42, x + w, y + h * 0.42).lineBetween(x + w / 2, y, x + w / 2, y + h * 0.42)
      g.fillStyle(PALETTE.navy, 1).fillRect(i === 0 ? x + 0.8 : x + w / 2, y + 0.8, w / 2 - 0.8, h * 0.42 - 0.8)
    })
  }

  private drawMarker(): void {
    const g = this.marker.clear()
    if (!this.highlight) return
    const block = this.blocks[SLOTS.indexOf(this.highlight.slot)]
    const color = HIGHLIGHT_COLOR[this.highlight.kind]
    g.fillStyle(color, 0.18).fillRect(2, block.y - 1, this.width - 4, block.h + 2)
    g.lineStyle(2.2, color, 1).strokeRect(2, block.y - 1, this.width - 4, block.h + 2)
  }
}

function weaponTitle(weapon: WeaponSummary): string {
  return weapon.id === 'staff' ? weapon.name : `${weapon.name} (tier ${weapon.tier})`
}

function weaponLines(weapon: WeaponSummary): string {
  return [`Damage: ${weapon.damageText} per hit`, `Speed: ${weapon.speedText} attacks/s`, `Reach: ${weapon.reachText}`].join('\n')
}

// One multi-line text per column, so the rows line up without a text object per cell.
function statColumns(stats: StatRow[]): { labels: string; values: string; bonuses: string } {
  return {
    labels: stats.map((row) => row.label).join('\n'),
    values: stats.map((row) => (row.plain || row.base === row.current ? row.current : `${row.base} -> ${row.current}`)).join('\n'),
    bonuses: stats.map((row) => row.bonusText || ' ').join('\n'),
  }
}
