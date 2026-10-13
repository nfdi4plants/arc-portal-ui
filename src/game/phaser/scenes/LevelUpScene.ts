import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { PowerUpCard, Rarity } from '../../contracts/progression'
import type { View } from '../view'
import type { RunContext } from './context'
import { addText, onCanvasKey, overlayView } from './ui'

const MAX_CARDS = 4
const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9aa0a6,
  uncommon: 0x2da44e,
  rare: 0x3b82f6,
  legendary: PALETTE.yellow,
}
const KEYS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
}

interface CardView {
  box: Phaser.GameObjects.Rectangle
  frame: Phaser.GameObjects.Graphics
  // A second gold frame whose alpha pulses on legendary cards.
  glow: Phaser.GameObjects.Graphics
  name: Phaser.GameObjects.Text
  description: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  key: Phaser.GameObjects.Text
}

// One card choice per level gained, one after the other. The gameplay scene stays held until the
// last choice.
export class LevelUpScene extends Phaser.Scene {
  private readonly ctx: RunContext
  private view!: View
  private dim!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private cards: CardView[] = []
  private offer: PowerUpCard[] = []

  constructor(ctx: RunContext) {
    super(SCENE.levelUp)
    this.ctx = ctx
  }

  create() {
    this.offer = []
    this.dim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.55).setOrigin(0, 0)
    this.title = addText(this, '', 14, { bold: true }).setOrigin(0.5, 0)
    this.cards = Array.from({ length: MAX_CARDS }, (_, i) => {
      const box = this.add.rectangle(0, 0, 1, 1, PALETTE.cream).setOrigin(0, 0)
      box.on('pointerup', () => this.choose(i))
      box.on('pointerover', () => box.setFillStyle(0xffffff))
      box.on('pointerout', () => box.setFillStyle(PALETTE.cream))
      return {
        box,
        frame: this.add.graphics(),
        glow: this.add.graphics(),
        name: addText(this, '', 9, { color: PALETTE.navy, bold: true, align: 'center' }).setOrigin(0.5, 0),
        description: addText(this, '', 7, { color: PALETTE.outline, align: 'center' }).setOrigin(0.5, 0),
        meta: addText(this, '', 6, { color: PALETTE.navy, align: 'center' }).setOrigin(0.5, 1),
        key: addText(this, String(i + 1), 8, { color: PALETTE.navy, bold: true }).setOrigin(0.5, 1),
      }
    })
    this.tweens.add({ targets: this.cards.map((card) => card.glow), alpha: 0.2, duration: 550, yoyo: true, repeat: -1 })
    onCanvasKey(this, (code) => {
      const index = KEYS[code]
      if (index !== undefined) this.choose(index)
    })
    overlayView(this, (view) => {
      this.view = view
      this.layout()
    })
    this.nextOffer()
  }

  private nextOffer() {
    const director = this.ctx.director
    const gameplay = this.ctx.gameplay
    if (!director || !gameplay) return
    while (director.pendingLevelUps > 0) {
      this.offer = director.rollOffer()
      if (this.offer.length > 0) break
      gameplay.chooseCard(null)
    }
    if (director.pendingLevelUps === 0) return
    const level = director.build.level - director.pendingLevelUps + 1
    this.title.setText(`Level ${level}: choose a card`)
    this.layout()
  }

  private choose(index: number) {
    const card = this.offer[index]
    if (!card) return
    this.offer = []
    this.ctx.gameplay?.chooseCard(card.id)
    if (this.ctx.director && this.ctx.director.pendingLevelUps > 0) this.nextOffer()
  }

  private layout() {
    if (!this.view) return
    const { width: w, height: h } = this.view
    this.dim.setSize(w, h)
    this.title.setPosition(w / 2, h * 0.12)
    const n = this.offer.length
    const gap = 8
    const cardW = Math.min(120, (w - 16 - gap * (Math.max(1, n) - 1)) / Math.max(1, n))
    const cardH = Math.min(120, h * 0.5)
    const left = w / 2 - (n * cardW + (n - 1) * gap) / 2
    const top = h * 0.12 + 28
    for (let i = 0; i < MAX_CARDS; i++) {
      const view = this.cards[i]
      const card = this.offer[i]
      const visible = card !== undefined
      for (const part of [view.box, view.frame, view.glow, view.name, view.description, view.meta, view.key]) part.setVisible(visible)
      // An interactive object keeps the hit area it was enabled with, so it is set up anew.
      view.box.removeInteractive()
      if (!visible) continue
      const x = left + i * (cardW + gap)
      const color = RARITY_COLOR[card.rarity]
      view.box.setPosition(x, top).setSize(cardW, cardH).setInteractive({ useHandCursor: true })
      view.frame.clear().lineStyle(3, color, 1).strokeRect(x, top, cardW, cardH)
      view.glow.clear()
      if (card.rarity === 'legendary') view.glow.lineStyle(2, 0xffe680, 1).strokeRect(x + 3, top + 3, cardW - 6, cardH - 6)
      view.name.setText(card.name).setWordWrapWidth(cardW - 10).setPosition(x + cardW / 2, top + 8)
      view.description.setText(card.description).setWordWrapWidth(cardW - 10).setPosition(x + cardW / 2, top + 14 + view.name.height)
      const slot = card.slot ? ` · ${card.slot} slot` : ''
      view.meta.setText(`${card.rarity}${slot}`).setPosition(x + cardW / 2, top + cardH - 14)
      view.key.setPosition(x + cardW / 2, top + cardH - 3)
    }
  }
}
