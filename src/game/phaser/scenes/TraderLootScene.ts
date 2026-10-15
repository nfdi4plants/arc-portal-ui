import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { PowerUpCard } from '../../contracts/progression'
import { applySpriteRef, CARD_HEIGHT, CARD_WIDTH, glowTexture, stallArt } from '../art'
import { cssColor } from '../color'
import type { View } from '../view'
import { createCardFace, showCardOn, sizeCardFace, type CardFace } from './cardFace'
import type { RunContext, TraderLoot } from './context'
import { drawScribbleBox } from './panelFrame'
import { addButton, addText, type Button, onCanvasKey, overlayView } from './ui'

// What the beaten FAIR trader left: every card of his stock, and the bonus, a legendary he never
// sold. The cards are applied already, like purchases. The overlay shows them until the player
// walks on, with Enter or the button after a short guard, so a key still going from the fight
// does not close it unseen.
const INTRO_MS = 300
const GUARD_MS = 600
const NAVY = cssColor(PALETTE.navy)
const CONTINUE_KEYS = new Set(['Enter', 'NumpadEnter', 'Space'])
const GAP = 8

export class TraderLootScene extends Phaser.Scene {
  private readonly ctx: RunContext
  private view: View | null = null
  private clock = 0
  private cards: PowerUpCard[] = []
  private faces: CardFace[] = []
  private dim!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private stall!: Phaser.GameObjects.Sprite
  private bubble!: Phaser.GameObjects.Graphics
  private line!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private bonusLabel!: Phaser.GameObjects.Text
  private button!: Button

  constructor(ctx: RunContext) {
    super(SCENE.traderLoot)
    this.ctx = ctx
  }

  create(loot: TraderLoot) {
    this.clock = 0
    this.view = null
    this.cards = loot.bonus ? [...loot.cards, loot.bonus] : [...loot.cards]
    this.dim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.72).setOrigin(0, 0)
    this.title = addText(this, 'Looted the FAIR trade stall', 16, { color: PALETTE.yellow, bold: true, align: 'center' }).setOrigin(0.5).setStroke(NAVY, 4)
    const ref = stallArt(this, 'empty')
    this.stall = this.add.sprite(0, 0, ref.textureKey)
    applySpriteRef(this.stall, ref)
    this.bubble = this.add.graphics()
    this.line = addText(this, loot.line, 8, { color: PALETTE.navy })
    const count = this.cards.length
    this.hint = addText(
      this,
      count === 0
        ? 'His stall was empty, and you hold every legendary already. Nothing left to loot.'
        : `${count === 1 ? 'This card is' : `These ${count} cards are`} yours, no fragments needed. He is gone for the rest of the run.`,
      7,
      { align: 'center' },
    )
      .setOrigin(0.5, 0)
      .setStroke(NAVY, 2)
    this.faces = this.cards.map((card, i) => {
      const face = createCardFace(this, glowTexture(this), '')
      showCardOn(this, face, card, i * 0.17)
      face.box.setVisible(true).setAlpha(0)
      return face
    })
    this.bonusLabel = addText(this, 'Bonus', 8, { color: PALETTE.yellow, bold: true }).setOrigin(0.5, 1).setStroke(NAVY, 3).setVisible(loot.bonus !== null)
    this.button = addButton(this, 'Walk on (Enter)', 100, 18, () => this.walkOn())
    onCanvasKey(this, (code, event) => {
      if (code === 'Space') event.preventDefault()
      if (CONTINUE_KEYS.has(code)) this.walkOn()
    })
    overlayView(this, (view) => {
      this.view = view
      this.layout()
    })
  }

  update(_time: number, delta: number) {
    this.clock += delta
    const t = Math.min(1, this.clock / INTRO_MS)
    this.dim.setAlpha(t)
    // The cards come in one after another.
    for (let i = 0; i < this.faces.length; i++) this.faces[i].box.setAlpha(Math.max(0, Math.min(1, (this.clock - 120 - i * 90) / 220)))
  }

  private walkOn() {
    if (this.clock < GUARD_MS) return
    this.ctx.gameplay?.closeTraderLoot()
  }

  private layout() {
    const view = this.view
    if (!view) return
    const { width: w, height: h } = view
    this.dim.setSize(w, h)
    const margin = Math.max(6, h * 0.025)
    const centre = w / 2
    this.title.setPosition(centre, margin + 10)
    // The empty stall and his last words.
    const stallH = Math.min(52, h * 0.15)
    const bubbleW = Math.min(w - 24 - stallH - 8, 320)
    this.line.setWordWrapWidth(bubbleW - 14, true)
    const bubbleH = Math.max(stallH * 0.55, this.line.height + 10)
    const rowTop = margin + 24
    const left = Math.max(8, centre - (stallH + 8 + bubbleW) / 2)
    this.stall.setDisplaySize(stallH, stallH).setPosition(left + stallH / 2, rowTop + Math.max(stallH, bubbleH))
    const bx = left + stallH + 8
    const by = rowTop + Math.max(0, (stallH - bubbleH) / 2)
    drawScribbleBox(this.bubble, bx, by, bubbleW, bubbleH, 31)
    this.line.setPosition(bx + 7, by + (bubbleH - this.line.height) / 2)
    const below = rowTop + Math.max(stallH, bubbleH) + 6
    this.hint.setWordWrapWidth(w - 32).setPosition(centre, below)
    // The cards in one row, as large as the room allows.
    const cardsTop = below + this.hint.height + 16
    const bottom = h - margin - 26
    const count = this.faces.length
    let cardH = Math.max(36, bottom - cardsTop)
    let cardW = (cardH * CARD_WIDTH) / CARD_HEIGHT
    if (count > 0 && cardW * count + GAP * (count - 1) > w - 16) {
      cardW = (w - 16 - GAP * (count - 1)) / count
      cardH = (cardW * CARD_HEIGHT) / CARD_WIDTH
    }
    const rowW = cardW * count + GAP * Math.max(0, count - 1)
    const cy = cardsTop + cardH / 2
    for (let i = 0; i < count; i++) {
      sizeCardFace(this.faces[i], this.cards[i], cardW)
      const x = centre - rowW / 2 + cardW / 2 + i * (cardW + GAP)
      this.faces[i].box.setPosition(x, cy)
      if (i === count - 1) this.bonusLabel.setPosition(x, cardsTop - 2).setFontSize(Math.max(6, cardW * 0.09))
    }
    this.button.setPosition(centre, h - margin - 10)
  }
}
