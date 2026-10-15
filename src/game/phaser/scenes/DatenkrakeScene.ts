import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import { CARDS, corruptedAugment, fillDealLine, type DatenkrakeDeal } from '../../model/progression'
import { applySpriteRef, CARD_HEIGHT, CARD_WIDTH, CORRUPTED_COLOR, corruptedCardArt, datenkrakeArt, glowTexture } from '../art'
import { cssColor } from '../color'
import type { View } from '../view'
import { createCardFace, fitText, showCardOn, sizeCardFace, type CardFace } from './cardFace'
import type { RunContext } from './context'
import { drawScribbleBox } from './panelFrame'
import { addButton, addText, type Button, onCanvasKey, overlayView } from './ui'

// Input waits this long after the overlay opens and after the deal shows, so a key or click still
// going from the walk does not choose.
const INTRO_MS = 400
const RESULT_GUARD_MS = 600
const NAVY = cssColor(PALETTE.navy)
const BOON_COLOR = '#5fe08a'
const CURSE_COLOR = '#ff7a75'
const FIGHT_KEYS = new Set(['Digit1', 'Numpad1'])
const SUBMIT_KEYS = new Set(['Digit2', 'Numpad2'])
const CONTINUE_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'Escape', 'Digit1', 'Numpad1'])

// The card of a corrupted augment: the glitched card art, its name, the boon in green and the
// curse in red.
interface CorruptedFace {
  box: Phaser.GameObjects.Container
  art: Phaser.GameObjects.Sprite
  name: Phaser.GameObjects.Text
  boon: Phaser.GameObjects.Text
  curse: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
}

// The Datenkrake's offer. The world is held and the mage hangs in a tentacle. "Fight back" frees
// the mage with every augment kept. "Submit" lets the kraken take a random augment and give a
// corrupted one, and the overlay shows both cards until the player goes on. Neither the pause key
// nor walking away leaves it: in the grip there is only the choice.
export class DatenkrakeScene extends Phaser.Scene {
  private readonly ctx: RunContext
  private view!: View
  private index = 0
  private clock = 0
  private resultAt = 0
  private deal: DatenkrakeDeal | null = null
  private dim!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private kraken!: Phaser.GameObjects.Sprite
  private bubble!: Phaser.GameObjects.Graphics
  private line!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private fightButton!: Button
  private submitButton!: Button
  private continueButton!: Button
  private taken!: CardFace
  private stamp!: Phaser.GameObjects.Text
  private given!: CorruptedFace
  private takenLabel!: Phaser.GameObjects.Text
  private givenLabel!: Phaser.GameObjects.Text
  private arrow!: Phaser.GameObjects.Text

  constructor(ctx: RunContext) {
    super(SCENE.datenkrake)
    this.ctx = ctx
  }

  create(data: { index?: number }) {
    this.index = data.index ?? 0
    this.clock = 0
    this.resultAt = 0
    this.deal = null
    this.dim = this.add.rectangle(0, 0, 1, 1, 0x12061c, 0.7).setOrigin(0, 0)
    this.title = addText(this, 'Datenkrake', 20, { color: CORRUPTED_COLOR, bold: true }).setOrigin(0.5).setStroke(NAVY, 4)
    const ref = datenkrakeArt(this)
    this.kraken = this.add.sprite(0, 0, ref.textureKey)
    applySpriteRef(this.kraken, ref)
    this.bubble = this.add.graphics()
    this.line = addText(this, '', 8, { color: PALETTE.navy })
    this.hint = addText(this, '', 7, { align: 'center' }).setOrigin(0.5, 0).setStroke(NAVY, 2)
    this.fightButton = addButton(this, 'Fight back (1)', 92, 18, () => this.fight())
    this.submitButton = addButton(this, 'Submit (2)', 92, 18, () => this.submit())
    this.continueButton = addButton(this, 'Walk on (Enter)', 96, 18, () => this.walkOn())
    this.continueButton.setVisible(false)
    this.taken = createCardFace(this, glowTexture(this), '')
    this.stamp = addText(this, 'TAKEN', 14, { color: 0xd9534f, bold: true }).setOrigin(0.5).setStroke('#fffdf6', 3).setRotation(-0.35)
    this.taken.box.add(this.stamp)
    this.given = this.createCorruptedFace()
    this.takenLabel = addText(this, 'Taken', 8, { bold: true }).setOrigin(0.5, 1).setStroke(NAVY, 3)
    this.givenLabel = addText(this, 'Received', 8, { color: CORRUPTED_COLOR, bold: true }).setOrigin(0.5, 1).setStroke(NAVY, 3)
    this.arrow = addText(this, '→', 18, { color: CORRUPTED_COLOR, bold: true }).setOrigin(0.5).setStroke(NAVY, 3)
    this.showResult(false)
    const director = this.ctx.director
    this.line.setText(director ? director.datenkrakeLine('grab') : '')
    this.hint.setText('Fight back: keep every augment and walk on.\nSubmit: lose a random augment, get a corrupted one. A gamble.')
    onCanvasKey(this, (code, event) => {
      if (code === 'Tab' || code === 'Space') event.preventDefault()
      if (this.clock < INTRO_MS) return
      if (this.deal) {
        if (CONTINUE_KEYS.has(code)) this.walkOn()
      } else if (FIGHT_KEYS.has(code)) this.fight()
      else if (SUBMIT_KEYS.has(code)) this.submit()
    })
    overlayView(this, (view) => {
      this.view = view
      this.layout()
    })
  }

  update(_time: number, delta: number) {
    this.clock += delta
    this.dim.setAlpha(Math.min(1, this.clock / INTRO_MS))
  }

  private createCorruptedFace(): CorruptedFace {
    const art = this.add.sprite(0, 0, corruptedCardArt(this).textureKey)
    applySpriteRef(art, corruptedCardArt(this))
    art.setOrigin(0.5)
    const name = addText(this, '', 8.5, { color: 0xffffff, bold: true, align: 'center' }).setOrigin(0.5)
    const boon = addText(this, '', 7, { align: 'center' }).setOrigin(0.5).setColor(BOON_COLOR)
    const curse = addText(this, '', 7, { align: 'center' }).setOrigin(0.5).setColor(CURSE_COLOR)
    const meta = addText(this, 'corrupted', 5.8, { color: CORRUPTED_COLOR, align: 'center' }).setOrigin(0.5)
    const box = this.add.container(0, 0, [art, name, boon, curse, meta])
    return { box, art, name, boon, curse, meta }
  }

  private fight() {
    if (this.clock < INTRO_MS || this.deal) return
    this.ctx.gameplay?.fightDatenkrake(this.index)
    this.ctx.gameplay?.closeDatenkrake()
  }

  private submit() {
    if (this.clock < INTRO_MS || this.deal) return
    const deal = this.ctx.gameplay?.submitToDatenkrake(this.index) ?? null
    // The build changed since the grab (nothing left to take): the kraken lets go as after a fight.
    if (!deal) {
      this.fight()
      return
    }
    this.deal = deal
    this.resultAt = this.clock
    const card = CARDS.find((entry) => entry.id === deal.taken)
    const augment = corruptedAugment(deal.given)
    if (card) showCardOn(this, this.taken, card, 0)
    this.given.name.setData('text', augment?.name ?? deal.given)
    this.given.boon.setData('text', `Boon: ${augment?.boon ?? ''}`)
    this.given.curse.setData('text', `Curse: ${augment?.curse ?? ''}`)
    const line = this.ctx.director?.datenkrakeLine('deal') ?? '{taken} for {given}.'
    this.line.setText(fillDealLine(line, card?.name ?? deal.taken, augment?.name ?? deal.given))
    this.hint.setText(augment ? augment.flavor : '')
    this.showResult(true)
    this.layout()
  }

  private walkOn() {
    if (!this.deal || this.clock - this.resultAt < RESULT_GUARD_MS) return
    this.ctx.gameplay?.closeDatenkrake()
  }

  private showResult(shown: boolean) {
    this.fightButton.setVisible(!shown)
    this.submitButton.setVisible(!shown)
    this.continueButton.setVisible(shown)
    this.taken.box.setVisible(shown)
    this.given.box.setVisible(shown)
    for (const text of [this.takenLabel, this.givenLabel, this.arrow]) text.setVisible(shown)
  }

  private layout() {
    if (!this.view) return
    const { width: w, height: h } = this.view
    this.dim.setSize(w, h)
    const margin = Math.max(6, h * 0.025)
    const top = margin
    const centre = w / 2
    this.title.setPosition(centre, top + 11)
    // The kraken and its speech bubble under the title.
    const krakenH = Math.min(58, h * 0.17)
    const krakenW = (krakenH * 96) / 80
    const bubbleW = Math.min(w - 24 - krakenW - 8, 380)
    this.line.setWordWrapWidth(bubbleW - 14, true)
    const bubbleH = Math.max(krakenH * 0.6, this.line.height + 10)
    const rowTop = top + 26
    const left = Math.max(8, centre - (krakenW + 8 + bubbleW) / 2)
    this.kraken.setDisplaySize(krakenW, krakenH).setPosition(left + krakenW / 2, rowTop + Math.max(krakenH, bubbleH))
    const bx = left + krakenW + 8
    const by = rowTop + Math.max(0, (krakenH - bubbleH) / 2)
    drawScribbleBox(this.bubble, bx, by, bubbleW, bubbleH, 23)
    this.bubble.fillStyle(PALETTE.cream, 0.97).fillTriangle(bx + 1, by + bubbleH * 0.45, bx + 1, by + bubbleH * 0.75, bx - 6, by + bubbleH * 0.7)
    this.line.setPosition(bx + 7, by + (bubbleH - this.line.height) / 2)
    const below = rowTop + Math.max(krakenH, bubbleH) + 8
    this.hint.setWordWrapWidth(w - 32).setPosition(centre, below)
    if (!this.deal) {
      const buttonsY = below + this.hint.height + 18
      this.fightButton.setPosition(centre - 52, buttonsY)
      this.submitButton.setPosition(centre + 52, buttonsY)
      return
    }
    // The deal: the card taken, an arrow and the corrupted card, as large as the room allows.
    const cardsTop = below + this.hint.height + 16
    const bottom = h - margin - 24
    const gap = 30
    let cardH = Math.max(40, bottom - cardsTop)
    let cardW = (cardH * CARD_WIDTH) / CARD_HEIGHT
    if (cardW * 2 + gap > w - 24) {
      cardW = (w - 24 - gap) / 2
      cardH = (cardW * CARD_HEIGHT) / CARD_WIDTH
    }
    const cy = cardsTop + cardH / 2
    const takenX = centre - gap / 2 - cardW / 2
    const givenX = centre + gap / 2 + cardW / 2
    const card = CARDS.find((entry) => entry.id === this.deal?.taken)
    if (card) sizeCardFace(this.taken, card, cardW)
    this.taken.box.setPosition(takenX, cy).setAlpha(0.92)
    this.stamp.setFontSize(Math.max(8, cardW * 0.2))
    this.sizeCorrupted(cardW)
    this.given.box.setPosition(givenX, cy)
    this.takenLabel.setPosition(takenX, cardsTop - 2)
    this.givenLabel.setPosition(givenX, cardsTop - 2)
    this.arrow.setPosition(centre, cy)
    this.continueButton.setPosition(centre, h - margin - 10)
  }

  private sizeCorrupted(w: number) {
    const face = this.given
    const s = w / CARD_WIDTH
    const h = (w * CARD_HEIGHT) / CARD_WIDTH
    const local = (x: number, y: number): [number, number] => [(x - CARD_WIDTH / 2) * s, (y - CARD_HEIGHT / 2) * s]
    face.art.setDisplaySize(w, h)
    face.name.setPosition(...local(50, 16.5))
    face.boon.setPosition(...local(50, 77.5))
    face.curse.setPosition(...local(50, 103.5))
    face.meta.setPosition(...local(50, 126)).setFontSize(5.8 * s)
    fitText(face.name, String(face.name.getData('text') ?? ''), 84 * s, 22 * s, 8.5 * s, 5 * s)
    fitText(face.boon, String(face.boon.getData('text') ?? ''), 80 * s, 21 * s, 6.5 * s, 4 * s)
    fitText(face.curse, String(face.curse.getData('text') ?? ''), 80 * s, 21 * s, 6.5 * s, 4 * s)
  }
}
