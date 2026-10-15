import type Phaser from 'phaser'
import { PALETTE } from '../../contracts/constants'
import type { Rarity } from '../../contracts/progression'
import { CORRUPTED_COLOR } from '../art'
import type { View } from '../view'
import { fitLine, historyRow, type LevelUpRecord } from './levelHistory'
import { drawScribbleBox } from './panelFrame'
import { addButton, addText, type Button } from './ui'

const MARGIN = 8
const PAD = 8
const MAX_WIDTH = 320
const ROW_H = 34
const HEADER_H = 24
const FOOTER_H = 30
const MAX_ROWS = 7
// Average glyph widths of the row fonts, to decide where a line is cut.
const CHAR_W_TITLE = 4.6
const CHAR_W_SMALL = 3.4
const GREY = 0x6b7280
const RARITY_COLOR: Record<Rarity, number> = { common: 0x9aa0a6, uncommon: 0x2da44e, rare: 0x3b82f6, legendary: PALETTE.yellow }

interface Row {
  marker: Phaser.GameObjects.Rectangle
  title: Phaser.GameObjects.Text
  source: Phaser.GameObjects.Text
  also: Phaser.GameObjects.Text
}

// The cards chosen so far, one row per level. The list moves a row at a time with the mouse wheel
// or a drag, so only the text of the visible rows ever changes and no clipping mask is needed.
export class LevelHistoryPanel {
  private readonly scene: Phaser.Scene
  private readonly swallow: Phaser.GameObjects.Rectangle
  private readonly frame: Phaser.GameObjects.Graphics
  private readonly title: Phaser.GameObjects.Text
  private readonly empty: Phaser.GameObjects.Text
  private readonly track: Phaser.GameObjects.Rectangle
  private readonly thumb: Phaser.GameObjects.Rectangle
  private readonly back: Button
  private readonly rows: Row[] = []
  private records: readonly LevelUpRecord[] = []
  private view: View | null = null
  private open = false
  private first = 0
  private capacity = 1
  private wheelRows = 0
  private dragging = false
  private dragStartY = 0
  private dragStartFirst = 0
  private box = { x: 0, y: 0, w: 0, h: 0 }

  constructor(scene: Phaser.Scene, onBack: () => void) {
    this.scene = scene
    this.swallow = scene.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.35).setOrigin(0, 0)
    this.frame = scene.add.graphics()
    this.title = addText(scene, 'Level-up provenance', 9, { color: PALETTE.navy, bold: true }).setOrigin(0.5, 0)
    this.empty = addText(scene, 'No level-ups yet. Every annotation you defeat brings you closer.', 7, {
      color: PALETTE.outline,
      align: 'center',
    }).setOrigin(0.5, 0.5)
    this.track = scene.add.rectangle(0, 0, 2, 1, PALETTE.navy, 0.2).setOrigin(0.5, 0)
    this.thumb = scene.add.rectangle(0, 0, 3, 1, PALETTE.navy, 0.8).setOrigin(0.5, 0)
    this.back = addButton(scene, 'Back', 80, 18, onBack)

    this.swallow.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.dragging = this.open
      this.dragStartY = pointer.y
      this.dragStartFirst = this.first
    })
    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.open || !this.dragging || !pointer.isDown) return
      const moved = (pointer.y - this.dragStartY) / scene.cameras.main.zoom
      this.scrollTo(this.dragStartFirst - Math.round(moved / ROW_H))
    })
    const stop = () => {
      this.dragging = false
    }
    scene.input.on('pointerup', stop)
    scene.input.on('pointerupoutside', stop)
    scene.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (!this.open) return
      // Trackpads send many small deltas, so rows move once a full notch has gathered.
      this.wheelRows += dy / 100
      const whole = Math.trunc(this.wheelRows)
      if (whole === 0) return
      this.wheelRows -= whole
      this.scrollTo(this.first + whole)
    })
    this.apply(false)
  }

  isOpen(): boolean {
    return this.open
  }

  show(records: readonly LevelUpRecord[]): void {
    this.records = records
    this.first = 0
    this.wheelRows = 0
    this.open = true
    this.apply(true)
    this.layout(this.view)
  }

  hide(): void {
    if (!this.open) return
    this.open = false
    this.dragging = false
    this.apply(false)
  }

  layout(view: View | null): void {
    this.view = view
    if (!view || !this.open) return
    const width = Math.min(view.width - 2 * MARGIN, MAX_WIDTH)
    const listRows = Math.max(1, Math.min(MAX_ROWS, Math.floor((view.height - 2 * MARGIN - HEADER_H - FOOTER_H) / ROW_H)))
    const height = HEADER_H + listRows * ROW_H + FOOTER_H
    const x = (view.width - width) / 2
    const y = (view.height - height) / 2
    this.box = { x, y, w: width, h: height }
    this.capacity = listRows
    this.swallow.setPosition(0, 0).setSize(view.width, view.height)
    this.swallow.removeInteractive()
    this.swallow.setInteractive()
    drawScribbleBox(this.frame, x, y, width, height, 5)
    this.title.setPosition(view.width / 2, y + 7)
    this.empty.setWordWrapWidth(width - 2 * PAD, true).setPosition(view.width / 2, y + HEADER_H + (listRows * ROW_H) / 2)
    this.back.setPosition(view.width / 2, y + height - FOOTER_H / 2)
    while (this.rows.length < listRows) this.rows.push(this.createRow())
    this.track.setPosition(x + width - 5, y + HEADER_H).setSize(2, listRows * ROW_H)
    this.scrollTo(this.first)
    this.refresh()
  }

  private createRow(): Row {
    return {
      marker: this.scene.add.rectangle(0, 0, 4, ROW_H - 8, PALETTE.navy).setOrigin(0, 0),
      title: addText(this.scene, '', 8, { color: PALETTE.navy, bold: true }),
      source: addText(this.scene, '', 6, { color: PALETTE.outline }),
      also: addText(this.scene, '', 6, { color: GREY }),
    }
  }

  private scrollTo(first: number): void {
    const clamped = Math.max(0, Math.min(Math.max(0, this.records.length - this.capacity), first))
    if (clamped === this.first) return
    this.first = clamped
    this.refresh()
  }

  private refresh(): void {
    const { x, y, w } = this.box
    const total = this.records.length
    this.empty.setVisible(this.open && total === 0)
    const textLeft = x + PAD + 8
    const room = w - 2 * PAD - 8 - 6
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i]
      const record = this.records[this.first + i]
      const visible = this.open && i < this.capacity && record !== undefined
      row.marker.setVisible(visible)
      row.title.setVisible(visible)
      row.source.setVisible(visible)
      if (!visible) {
        row.also.setVisible(false)
        continue
      }
      const text = historyRow(record)
      const top = y + HEADER_H + i * ROW_H
      // The Datenkrake's corrupted augments and lost fights glitch purple.
      const kraken = record.datenkrake === 'corrupted' || record.datenkrake === 'fought'
      row.marker.setPosition(x + PAD, top + 3).setFillStyle(kraken ? CORRUPTED_COLOR : record.rarity ? RARITY_COLOR[record.rarity] : GREY)
      row.title.setText(fitLine(text.title, Math.floor(room / CHAR_W_TITLE))).setPosition(textLeft, top + 2)
      row.source.setText(fitLine(text.source, Math.floor(room / CHAR_W_SMALL))).setPosition(textLeft, top + 14)
      row.also
        .setText(fitLine(text.also ?? '', Math.floor(room / CHAR_W_SMALL)))
        .setPosition(textLeft, top + 23)
        .setVisible(text.also !== null)
    }
    const scrolls = this.open && total > this.capacity
    this.track.setVisible(scrolls)
    this.thumb.setVisible(scrolls)
    if (scrolls) {
      const trackH = this.capacity * ROW_H
      const thumbH = Math.max(10, (trackH * this.capacity) / total)
      const along = total - this.capacity > 0 ? this.first / (total - this.capacity) : 0
      this.thumb.setPosition(x + w - 5, y + HEADER_H + along * (trackH - thumbH)).setSize(3, thumbH)
    }
  }

  private apply(visible: boolean): void {
    for (const part of [this.swallow, this.frame, this.title, this.track, this.thumb]) part.setVisible(visible)
    this.back.setVisible(visible)
    if (!visible) {
      this.swallow.disableInteractive()
      this.empty.setVisible(false)
      for (const row of this.rows) {
        row.marker.setVisible(false)
        row.title.setVisible(false)
        row.source.setVisible(false)
        row.also.setVisible(false)
      }
    }
  }
}
