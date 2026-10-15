import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import type { PlayerBuild } from '../../contracts/progression'
import { CARDS, corruptedAugment } from '../../model/progression'
import { CORRUPTED_COLOR, RARITY_COLOR } from '../art'
import type { View } from '../view'
import { BuildPanel } from './BuildPanel'
import { fitLine, runRecap, type LevelUpRecord, type RecapEntry } from './levelHistory'
import { drawScribbleBox } from './panelFrame'
import { addButton, addText, type Button, onCanvasKey, onClick, plural } from './ui'

// From this view width on the recap stands beside the end text. Narrower views show it on request.
export const RECAP_SIDE_MIN_WIDTH = 600
const KEY = 'KeyB'
const PAD = 7
// Sizes beside the end text. The overlay of narrow views has the whole view and scales them up.
const FONT = 7
const SMALL_FONT = 6
const ROW_H = 12
const HEADER_H = 18
const FOOTER_H = 26
const OVERLAY_SCALE = 1.25
const GREY = 0x6b7280
// Average glyph widths of the row fonts in font sizes, to decide where a name is cut.
const CHAR_EM_BOLD = 0.58
const CHAR_EM = 0.5

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

interface Row {
  marker: Phaser.GameObjects.Rectangle
  tag: Phaser.GameObjects.Text
  name: Phaser.GameObjects.Text
  note: Phaser.GameObjects.Text
}

// The "Your run" recap of the death and victory screens: every augment of the run in order, level-ups
// and purchases, and the final build (BuildPanel). Wide views show it beside the end text, narrow
// ones behind the "Your run (B)" button. The list moves a row at a time with the wheel or a drag, so
// only the text of the visible rows changes, and hovering a row shows its card text under the list.
// Everything is laid out on a view change or a scroll, never per frame.
export class RunRecapPanel {
  private readonly scene: Phaser.Scene
  private readonly entries: RecapEntry[]
  private readonly blocker: Phaser.GameObjects.Rectangle
  private readonly paper: Phaser.GameObjects.Graphics
  private readonly header: Phaser.GameObjects.Text
  private readonly empty: Phaser.GameObjects.Text
  private readonly footer: Phaser.GameObjects.Text
  private readonly track: Phaser.GameObjects.Rectangle
  private readonly thumb: Phaser.GameObjects.Rectangle
  private readonly listZone: Phaser.GameObjects.Zone
  private readonly build: BuildPanel
  private readonly openButton: Button
  private readonly closeButton: Button
  private readonly rows: Row[] = []
  private readonly summaryLine: string
  private view: View | null = null
  private side = false
  private open = false
  private first = 0
  private capacity = 1
  private hovered = -1
  private wheelRows = 0
  private dragging = false
  private dragStartY = 0
  private dragStartFirst = 0
  private list: Rect = { x: 0, y: 0, w: 0, h: 0 }
  // Text scale and row height of the current layout.
  private scale = 1
  private rowH = ROW_H
  // Characters that fit the two footer lines.
  private footerChars = 80
  private sideRect: Rect = { x: 0, y: 0, w: 0, h: 0 }

  constructor(scene: Phaser.Scene, records: readonly LevelUpRecord[], build: PlayerBuild) {
    this.scene = scene
    this.entries = runRecap(records)
    const bought = this.entries.filter((entry) => entry.tag === 'Bought').length
    const taken = this.entries.filter((entry) => !entry.skipped && !entry.datenkrake).length
    this.summaryLine = taken === 0 ? '' : `${plural(taken, 'augment')}${bought > 0 ? `, ${bought} bought at the FAIR trade store` : ''}. Hover one for its card.`
    this.blocker = scene.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.6).setOrigin(0, 0).setVisible(false)
    onClick(scene, this.blocker, () => this.setOpen(false))
    this.paper = scene.add.graphics()
    this.header = addText(scene, 'Your run', 9, { color: PALETTE.navy, bold: true })
    this.empty = addText(scene, 'No augments this run. Defeat annotations to level up.', FONT, { color: PALETTE.outline, align: 'center' }).setOrigin(0.5)
    this.footer = addText(scene, '', 6, { color: PALETTE.outline })
    this.track = scene.add.rectangle(0, 0, 2, 1, PALETTE.navy, 0.2).setOrigin(0.5, 0)
    this.thumb = scene.add.rectangle(0, 0, 3, 1, PALETTE.navy, 0.8).setOrigin(0.5, 0)
    this.listZone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0)
    this.build = new BuildPanel(scene)
    this.build.setBuild(build)
    this.openButton = addButton(scene, 'Your run (B)', 96, 20, () => this.setOpen(true))
    this.closeButton = addButton(scene, 'Back (B)', 80, 18, () => this.setOpen(false))

    this.listZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = true
      this.dragStartY = pointer.y
      this.dragStartFirst = this.first
    })
    this.listZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const row = Math.floor((pointer.worldY - this.list.y) / this.rowH)
      this.setHovered(row >= 0 && row < this.capacity ? this.first + row : -1)
    })
    this.listZone.on('pointerout', () => this.setHovered(-1))
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return
      const moved = (pointer.y - this.dragStartY) / scene.cameras.main.zoom
      this.scrollTo(this.dragStartFirst - Math.round(moved / this.rowH))
    })
    const stop = () => {
      this.dragging = false
    }
    scene.input.on('pointerup', stop)
    scene.input.on('pointerupoutside', stop)
    scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (!this.shown()) return
      const { x, y, w, h } = this.list
      if (pointer.worldX < x || pointer.worldX > x + w || pointer.worldY < y || pointer.worldY > y + h) return
      // Trackpads send many small deltas, so rows move once a full notch has gathered.
      this.wheelRows += dy / 100
      const whole = Math.trunc(this.wheelRows)
      if (whole === 0) return
      this.wheelRows -= whole
      this.scrollTo(this.first + whole)
    })
    onCanvasKey(scene, (code) => {
      if (this.side) return
      if (code === KEY) this.setOpen(!this.open)
      else if (code === 'Escape') this.setOpen(false)
    })
  }

  // Wide views pass the rect the recap stays in. Narrow views pass null and where the open button goes.
  layout(view: View, rect: Rect | null, button: { x: number; y: number }): void {
    this.view = view
    this.side = rect !== null
    if (rect) this.sideRect = rect
    else this.openButton.setPosition(button.x, button.y)
    this.blocker.setSize(view.width, view.height)
    this.arrange()
  }

  private shown(): boolean {
    return this.side || this.open
  }

  private setOpen(open: boolean): void {
    this.open = open && !this.side
    this.arrange()
  }

  private arrange(): void {
    const view = this.view
    if (!view) return
    const shown = this.shown()
    this.blocker.setVisible(this.open)
    if (this.open) this.blocker.setInteractive({ useHandCursor: true })
    else this.blocker.disableInteractive()
    this.openButton.setVisible(!this.side && !this.open)
    this.closeButton.setVisible(this.open)
    for (const part of [this.paper, this.header, this.footer]) part.setVisible(shown)
    this.build.setVisible(shown)
    if (shown) this.listZone.setInteractive()
    else this.listZone.disableInteractive()
    if (!shown) {
      this.empty.setVisible(false)
      this.refresh()
      return
    }
    const margin = 8
    const rect = this.side ? this.sideRect : { x: margin, y: margin, w: view.width - margin * 2, h: view.height - margin * 2 - 24 }
    if (this.open) this.closeButton.setPosition(view.width / 2, rect.y + rect.h + 14)
    this.setScale(this.side ? 1 : OVERLAY_SCALE)
    const k = this.scale
    // The list takes a bit more than half, the build the rest. The list paper ends below its last
    // row, at most at the bottom of the rect.
    const gap = 6
    const listW = Math.floor((rect.w - gap) * 0.52)
    const buildW = rect.w - listW - gap
    const headerH = HEADER_H * k
    const footerH = FOOTER_H * k
    const rowsH = Math.min(rect.h - headerH - footerH, Math.max(3, this.entries.length) * this.rowH)
    const listH = headerH + rowsH + footerH
    drawScribbleBox(this.paper, rect.x, rect.y, listW, listH, 9)
    this.header.setText(`Your run · ${this.entries.length > 0 ? plural(this.entries.length, 'card') : 'no augments'}`).setPosition(rect.x + PAD, rect.y + 5)
    this.footerChars = Math.floor(((listW - PAD * 2) / (SMALL_FONT * k * CHAR_EM)) * 1.8)
    this.footer.setWordWrapWidth(listW - PAD * 2, true).setPosition(rect.x + PAD, rect.y + listH - footerH + 3)
    this.list = { x: rect.x + PAD, y: rect.y + headerH, w: listW - PAD * 2 - 6, h: rowsH }
    this.capacity = Math.max(1, Math.floor(rowsH / this.rowH))
    while (this.rows.length < this.capacity) this.rows.push(this.createRow())
    for (const row of this.rows) this.sizeRow(row)
    this.listZone.setPosition(this.list.x, this.list.y).setSize(this.list.w, this.capacity * this.rowH)
    this.track.setPosition(rect.x + listW - 6, this.list.y).setSize(2, this.capacity * this.rowH)
    this.empty.setWordWrapWidth(listW - PAD * 2, true).setPosition(rect.x + listW / 2, this.list.y + rowsH / 2).setVisible(this.entries.length === 0)
    // The biggest build text whose panel fits the height.
    const buildX = rect.x + listW + gap
    for (let size = FONT * k; size >= 4.5; size -= 0.5) {
      this.build.place(buildX, rect.y, buildW, size)
      if (this.build.height <= rect.h) break
    }
    this.first = Math.max(0, Math.min(this.first, this.entries.length - this.capacity))
    this.refresh()
  }

  private setScale(scale: number): void {
    if (scale === this.scale) return
    this.scale = scale
    this.rowH = Math.round(ROW_H * scale)
    this.header.setFontSize(9 * scale)
    this.footer.setFontSize(SMALL_FONT * scale)
    this.empty.setFontSize(FONT * scale)
  }

  private sizeRow(row: Row): void {
    const k = this.scale
    if (row.name.style.fontSize === `${FONT * k}px`) return
    row.marker.setSize(3, this.rowH - 3)
    row.tag.setFontSize(SMALL_FONT * k)
    row.name.setFontSize(FONT * k)
    row.note.setFontSize(SMALL_FONT * k)
  }

  private createRow(): Row {
    const row = {
      marker: this.scene.add.rectangle(0, 0, 3, ROW_H - 3, PALETTE.navy).setOrigin(0, 0),
      tag: addText(this.scene, '', SMALL_FONT, { color: GREY }),
      name: addText(this.scene, '', FONT, { color: PALETTE.navy, bold: true }),
      note: addText(this.scene, '', SMALL_FONT, { color: GREY }),
    }
    for (const part of [row.marker, row.tag, row.name, row.note]) part.setVisible(false)
    return row
  }

  private scrollTo(first: number): void {
    const clamped = Math.max(0, Math.min(Math.max(0, this.entries.length - this.capacity), first))
    if (clamped === this.first) return
    this.first = clamped
    this.refresh()
  }

  private setHovered(index: number): void {
    const next = index < this.entries.length ? index : -1
    if (next === this.hovered) return
    this.hovered = next
    this.refreshFooter()
  }

  private refreshFooter(): void {
    const entry = this.entries[this.hovered]
    const card = entry?.cardId ? CARDS.find((c) => c.id === entry.cardId) : undefined
    const augment = entry?.datenkrake === 'corrupted' && entry.cardId ? corruptedAugment(entry.cardId) : undefined
    const text = augment ? `${augment.name}: ${augment.boon} Curse: ${augment.curse}` : card ? `${card.name}: ${card.description}` : this.summaryLine
    this.footer.setText(fitLine(text, this.footerChars))
  }

  private refresh(): void {
    const shown = this.shown()
    const { x, y, w } = this.list
    const k = this.scale
    const tagW = FONT * k * 3.6
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]
      const entry = this.entries[this.first + i]
      const visible = shown && i < this.capacity && entry !== undefined
      for (const part of [row.marker, row.tag, row.name, row.note]) part.setVisible(visible)
      if (!visible) continue
      const top = y + i * this.rowH
      const alpha = entry.skipped ? 0.45 : 1
      row.marker.setPosition(x, top + 1).setFillStyle(markerColor(entry)).setAlpha(alpha)
      row.tag.setText(entry.tag).setPosition(x + 6, top + 2).setAlpha(alpha)
      const nameX = x + 6 + tagW
      const room = w - (nameX - x)
      row.name.setText(fitLine(entry.name, Math.floor(room / (FONT * k * CHAR_EM_BOLD)))).setPosition(nameX, top + 1).setAlpha(alpha)
      const noteRoom = room - row.name.width - 5
      row.note
        .setText(fitLine(entry.note, Math.floor(noteRoom / (SMALL_FONT * k * CHAR_EM))))
        .setPosition(nameX + row.name.width + 5, top + 2)
        .setVisible(entry.note !== '' && noteRoom > 30)
    }
    const total = this.entries.length
    const scrolls = shown && total > this.capacity
    this.track.setVisible(scrolls)
    this.thumb.setVisible(scrolls)
    if (scrolls) {
      const trackH = this.capacity * this.rowH
      const thumbH = Math.max(10, (trackH * this.capacity) / total)
      const along = this.first / (total - this.capacity)
      this.thumb.setPosition(this.track.x, y + along * (trackH - thumbH)).setSize(3, thumbH)
    }
    this.refreshFooter()
  }
}

// The Datenkrake's entries glitch purple. What it took keeps the rarity of the card.
function markerColor(entry: RecapEntry): number {
  if (entry.datenkrake === 'corrupted' || entry.datenkrake === 'fought') return CORRUPTED_COLOR
  return entry.rarity ? RARITY_COLOR[entry.rarity] : GREY
}
