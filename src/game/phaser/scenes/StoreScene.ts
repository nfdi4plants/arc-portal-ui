import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { PowerUpCard } from '../../contracts/progression'
import { hashString } from '../../contracts/rng'
import { bindingLabel } from '../../model/input'
import { priceOf, STOCK_SIZE, stockState, weaponRelation, type StockState } from '../../model/progression'
import { applySpriteRef, CARD_HEIGHT, CARD_WIDTH, fragmentArt, glowTexture, traderArt } from '../art'
import { cssColor } from '../color'
import type { View } from '../view'
import { BuildPanel } from './BuildPanel'
import { CardNote, createCardFace, showCardOn, sizeCardFace, type CardFace } from './cardFace'
import { cardHitRect } from './cardHit'
import type { RunContext } from './context'
import { drawScribbleBox } from './panelFrame'
import { addButton, addText, type Button, onCanvasKey, onClick, overlayView } from './ui'

// Mouse button that buys a card, the same as the one that chooses a level-up card.
const BUY_BUTTON: 0 | 2 = 0
const KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }
// Input waits this long after the store opens, so a click still held from the arena buys nothing.
const INTRO_MS = 350
const HOVER_DETAILS_MS = 600
const TILT = (3 * Math.PI) / 180
// A hovered card lifts by this share of its height and grows by HOVER_GROW. Every card bobs by BOB.
const HOVER_LIFT = 0.04
const HOVER_GROW = 0.06
const BOB = 0.012
const SIDE_PANEL_MIN_WIDTH = 600
const BUILD_KEY = 'KeyB'
const NAVY = cssColor(PALETTE.navy)
const DIM_ALPHA: Record<StockState, number> = { buy: 1, poor: 0.5, unusable: 0.35 }
const PRICE_COLOR: Record<StockState, string> = { buy: cssColor(PALETTE.yellow), poor: '#f28b82', unusable: '#b8bec6' }

interface StockView {
  face: CardFace
  zone: Phaser.GameObjects.Zone
  fragment: Phaser.GameObjects.Sprite
  price: Phaser.GameObjects.Text
  state: StockState
  x: number
  y: number
  w: number
  h: number
  tilt: number
  phase: number
  hover: number
}

// The FAIR trade store of the trader after a node boss. The world is held while it is open. A card
// is bought by a click on it or the keys 1 to 4. The Leave button closes it, and so do the pause
// key and the move keys, which the gameplay scene reads.
export class StoreScene extends Phaser.Scene {
  private readonly ctx: RunContext
  private view!: View
  private index = 0
  private stock: readonly PowerUpCard[] = []
  private dim!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private trader!: Phaser.GameObjects.Sprite
  private bubble!: Phaser.GameObjects.Graphics
  private line!: Phaser.GameObjects.Text
  private purse!: Phaser.GameObjects.Text
  private purseIcon!: Phaser.GameObjects.Sprite
  private hint!: Phaser.GameObjects.Text
  private empty!: Phaser.GameObjects.Text
  private cards: StockView[] = []
  private note!: CardNote
  private buildPanel!: BuildPanel
  private buildButton!: Button
  private leaveButton!: Button
  private buildBlocker!: Phaser.GameObjects.Rectangle
  private buildOpen = false
  private sideLayout = false
  private areaX = 0
  private areaW = 0
  private stripTop = 0
  private clock = 0
  private hovered = -1
  private hoverMs = 0
  private detailIndex = -1
  private pinned = false

  constructor(ctx: RunContext) {
    super(SCENE.store)
    this.ctx = ctx
  }

  create(data: { index?: number }) {
    const director = this.ctx.director
    this.index = data.index ?? 0
    this.clock = 0
    this.hovered = -1
    this.detailIndex = -1
    this.pinned = false
    this.buildOpen = false
    this.dim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.6).setOrigin(0, 0)
    this.title = addText(this, 'FAIR trade', 20, { color: PALETTE.yellow, bold: true }).setOrigin(0.5).setStroke(NAVY, 4)
    const traderRef = traderArt(this)
    this.trader = this.add.sprite(0, 0, traderRef.textureKey)
    applySpriteRef(this.trader, traderRef)
    this.bubble = this.add.graphics()
    this.line = addText(this, '', 7.5, { color: PALETTE.navy })
    const fragmentRef = fragmentArt(this)
    this.purseIcon = this.add.sprite(0, 0, fragmentRef.textureKey)
    applySpriteRef(this.purseIcon, fragmentRef)
    this.purseIcon.setOrigin(0.5)
    this.purse = addText(this, '', 10, { color: PALETTE.yellow, bold: true }).setOrigin(1, 0.5).setStroke(NAVY, 3)
    this.hint = addText(this, '', 7, { align: 'center' }).setOrigin(0.5, 0).setStroke(NAVY, 2)
    this.empty = addText(this, 'Sold out! The table is bare, the trader is happy.', 9, { align: 'center', bold: true }).setOrigin(0.5).setStroke(NAVY, 3)
    const glowKey = glowTexture(this)
    this.cards = Array.from({ length: STOCK_SIZE }, (_, i) => this.createCard(i, glowKey))
    this.note = new CardNote(this)
    this.buildBlocker = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.6).setOrigin(0, 0).setVisible(false)
    onClick(this, this.buildBlocker, () => this.setBuildOpen(false))
    this.buildPanel = new BuildPanel(this)
    this.buildButton = addButton(this, 'Your build (B)', 76, 14, () => this.setBuildOpen(!this.buildOpen))
    this.leaveButton = addButton(this, 'Leave', 44, 14, () => this.ctx.gameplay?.closeStore())
    onCanvasKey(this, (code, event) => {
      if (code === 'Tab') event.preventDefault()
      if (this.clock < INTRO_MS) return
      if (code === BUILD_KEY && !this.sideLayout) {
        this.setBuildOpen(!this.buildOpen)
        return
      }
      if (this.buildOpen) {
        if (code === 'Escape') this.setBuildOpen(false)
        return
      }
      const index = KEYS[code]
      if (index !== undefined) this.buy(index)
      else if (code === 'Slash' || code === 'Tab' || event.key === '?') this.toggleFromKey()
    })
    this.say(director ? director.traderLine('greeting') : '')
    this.refreshStock()
    overlayView(this, (view) => {
      this.view = view
      this.layout()
    })
  }

  update(_time: number, delta: number) {
    this.clock += delta
    const intro = Math.min(1, this.clock / INTRO_MS)
    this.dim.setAlpha(intro)
    const ease = Math.min(1, delta / 80)
    for (let i = 0; i < this.stock.length; i++) {
      const card = this.cards[i]
      card.hover += ((i === this.hovered ? 1 : 0) - card.hover) * ease
      this.poseCard(card, intro)
    }
    this.buildPanel.pulse(this.clock)
    if (this.hovered >= 0 && this.detailIndex !== this.hovered) {
      this.hoverMs += delta
      if (this.hoverMs >= HOVER_DETAILS_MS) this.showDetails(this.hovered, false)
    }
  }

  private createCard(index: number, glowKey: string): StockView {
    const face = createCardFace(this, glowKey, String(index + 1))
    const fragmentRef = fragmentArt(this)
    const fragment = this.add.sprite(0, 0, fragmentRef.textureKey)
    applySpriteRef(fragment, fragmentRef)
    fragment.setOrigin(0.5)
    const price = addText(this, '', 8, { bold: true }).setOrigin(0, 0.5).setStroke(NAVY, 3)
    const zone = this.add.zone(0, 0, 1, 1)
    zone.on('pointerover', () => {
      if (this.clock < INTRO_MS) return
      this.hovered = index
      this.hoverMs = 0
      this.syncHighlight()
    })
    zone.on('pointerout', () => {
      if (this.hovered === index) this.hovered = -1
      this.syncHighlight()
      if (this.detailIndex === index && !this.pinned) this.hideDetails()
    })
    onClick(this, zone, () => this.buy(index), BUY_BUTTON)
    return { face, zone, fragment, price, state: 'buy', x: 0, y: 0, w: 1, h: 1, tilt: 0, phase: 0, hover: 0 }
  }

  // Reads the stock, the Ontology Fragments and the build again. Runs on open and after every purchase.
  private refreshStock() {
    const director = this.ctx.director
    if (!director) return
    this.stock = director.stock(this.index)
    this.hideDetails()
    this.hovered = -1
    this.syncHighlight()
    this.buildPanel.setBuild(director.build)
    this.purse.setText(String(director.fragments))
    this.stock.forEach((card, i) => {
      const view = this.cards[i]
      showCardOn(this, view.face, card, i / STOCK_SIZE)
      view.tilt = ((hashString(card.id) % 1001) / 500 - 1) * TILT
      view.phase = (hashString(card.id) % 628) / 100
      view.state = stockState(director.build, director.fragments, card)
      view.price.setText(view.state === 'unusable' ? 'no use now' : String(priceOf(card))).setColor(PRICE_COLOR[view.state])
      view.fragment.setAlpha(view.state === 'unusable' ? 0 : DIM_ALPHA[view.state])
    })
    for (let i = 0; i < this.cards.length; i++) {
      const shown = i < this.stock.length
      const view = this.cards[i]
      if (!shown) view.face.box.setVisible(false)
      view.fragment.setVisible(shown)
      view.price.setVisible(shown)
    }
    this.empty.setVisible(this.stock.length === 0)
    const pause = this.ctx.bindings.pause[0]
    const leave = pause ? `${bindingLabel(pause)}, walk away or Leave to go` : 'Walk away or Leave to go'
    this.hint.setText(this.stock.length > 0 ? `Click a card to trade Ontology Fragments for it · hover for details · ${leave}` : leave)
    this.layout()
  }

  private buy(index: number) {
    if (this.clock < INTRO_MS || this.buildOpen) return
    const director = this.ctx.director
    const card = this.stock[index]
    if (!director || !card) return
    const state = stockState(director.build, director.fragments, card)
    if (state !== 'buy') {
      this.say(director.traderLine(state === 'poor' ? 'poor' : 'unusable'))
      this.layout()
      return
    }
    if (!this.ctx.gameplay?.buyCard(this.index, card.id)) return
    this.say(director.traderLine('bought'))
    this.refreshStock()
  }

  private say(line: string) {
    this.line.setText(line)
  }

  private poseCard(view: StockView, intro: number) {
    const face = view.face
    const bob = Math.sin(this.clock / 650 + view.phase) * view.h * BOB
    const rotation = view.tilt * (1 - view.hover)
    for (const text of face.texts) text.setRotation(-rotation)
    face.box
      .setVisible(true)
      .setPosition(view.x, view.y + (1 - intro) * view.h * 0.15 + bob - view.hover * view.h * HOVER_LIFT)
      .setRotation(rotation)
      .setScale(1 + HOVER_GROW * view.hover)
      .setAlpha(intro * DIM_ALPHA[view.state])
    if (face.glow.visible) face.glow.setAlpha(0.55 + 0.3 * Math.sin(this.clock / 260))
  }

  private layout() {
    if (!this.view) return
    const { width: w, height: h } = this.view
    this.dim.setSize(w, h)
    this.buildBlocker.setSize(w, h)
    const margin = Math.max(6, h * 0.025)
    this.layoutBuildPanel(w, h, margin)
    const areaW = this.areaW
    const centre = this.areaX + areaW / 2
    const top = margin
    // Title row: build button, title, the Ontology Fragments and the Leave button.
    this.title.setPosition(centre, top + 11)
    if (!this.sideLayout) this.buildButton.setPosition(8 + 38, top + 11)
    const right = this.areaX + areaW - 8
    this.leaveButton.setPosition(right - 22, top + 11)
    this.purse.setPosition(right - 50, top + 11)
    this.purseIcon.setPosition(right - 50 - this.purse.width - 7, top + 11)
    // The trader and the speech bubble under the title.
    const traderH = Math.min(46, h * 0.13)
    const traderW = traderH
    const bubbleW = Math.min(areaW - 16 - traderW - 8, 380)
    this.line.setWordWrapWidth(bubbleW - 14, true)
    const bubbleH = Math.max(traderH * 0.7, this.line.height + 10)
    const rowTop = top + 26
    const left = Math.max(this.areaX + 8, centre - (traderW + 8 + bubbleW) / 2)
    this.trader.setDisplaySize(traderW, traderH).setPosition(left + traderW / 2, rowTop + Math.max(traderH, bubbleH))
    const bx = left + traderW + 8
    const by = rowTop + Math.max(0, (traderH - bubbleH) / 2)
    drawScribbleBox(this.bubble, bx, by, bubbleW, bubbleH, 11)
    // The bubble's tail points at the trader.
    this.bubble.fillStyle(PALETTE.cream, 0.97).fillTriangle(bx + 1, by + bubbleH * 0.45, bx + 1, by + bubbleH * 0.75, bx - 6, by + bubbleH * 0.7)
    this.line.setPosition(bx + 7, by + (bubbleH - this.line.height) / 2)
    const head = rowTop - top + Math.max(traderH, bubbleH) + 6
    const strip = Math.max(54, h * 0.2)
    const priceRow = 14
    const n = this.stock.length
    const room = h - margin * 2 - head - strip - priceRow - 10
    const cardsTop = top + head
    this.stripTop = cardsTop + room + priceRow + 6
    this.hint.setPosition(centre, this.stripTop + 4).setWordWrapWidth(areaW - 24)
    this.empty.setPosition(centre, cardsTop + room / 2).setWordWrapWidth(areaW - 32)
    if (n === 0) {
      this.enableInput()
      return
    }
    const gap = areaW * 0.025
    let cardW = (areaW - 16 - gap * (Math.max(n, 3) - 1)) / Math.max(n, 3)
    let cardH = (cardW * CARD_HEIGHT) / CARD_WIDTH
    // Room for the hover lift and scale, about a tenth of the card at each end.
    if (cardH * 1.15 > room) {
      cardH = room / 1.15
      cardW = (cardH * CARD_WIDTH) / CARD_HEIGHT
    }
    const rowLeft = centre - (n * cardW + (n - 1) * gap) / 2
    for (let i = 0; i < n; i++) {
      const view = this.cards[i]
      view.x = rowLeft + cardW / 2 + i * (cardW + gap)
      view.y = cardsTop + room / 2
      view.w = cardW
      view.h = cardH
      // The hit area covers the card in every pose, hovered or not (cardHitRect).
      const hit = cardHitRect({ w: cardW, h: cardH, tilt: TILT, lift: HOVER_LIFT, bob: BOB, hoverScale: 1 + HOVER_GROW, gap })
      view.zone.setPosition(view.x, view.y + (hit.top + hit.bottom) / 2).setSize(hit.right - hit.left, hit.bottom - hit.top)
      sizeCardFace(view.face, this.stock[i], cardW)
      const priceY = view.y + cardH * 0.55 + priceRow / 2 + 2
      const size = Math.max(6.5, Math.min(9, cardW * 0.09))
      view.price.setFontSize(size)
      const unusable = view.state === 'unusable'
      const iconW = unusable ? 0 : 10
      const startX = view.x - (iconW + view.price.width) / 2
      view.fragment.setPosition(startX + 4.5, priceY)
      view.price.setPosition(startX + iconW, priceY)
    }
    this.enableInput()
    if (this.detailIndex >= 0) this.renderPanel()
  }

  private enableInput() {
    for (let i = 0; i < STOCK_SIZE; i++) {
      const zone = this.cards[i].zone
      // Switched on and off, never removed: Phaser clears an input that is removed and added again
      // in the same frame, which left every card dead after a purchase. The hit area follows setSize.
      if (i < this.stock.length) zone.setInteractive({ useHandCursor: true })
      else zone.disableInteractive()
    }
  }

  private layoutBuildPanel(w: number, h: number, margin: number) {
    this.sideLayout = w >= SIDE_PANEL_MIN_WIDTH
    if (this.sideLayout) {
      const panelW = Math.min(250, w * 0.37)
      this.buildPanel.place(8, margin, panelW, 7)
      this.areaX = 8 + panelW + 8
      this.areaW = w - this.areaX - 8
      this.buildOpen = false
    } else {
      this.areaX = 0
      this.areaW = w
      const panelW = Math.min(w - 16, 340)
      this.buildPanel.place(0, 0, panelW, 11)
      this.buildPanel.moveTo((w - panelW) / 2, Math.max(margin, (h - this.buildPanel.height) / 2))
    }
    this.updateBuildButton()
  }

  private setBuildOpen(open: boolean) {
    this.buildOpen = open && !this.sideLayout
    this.updateBuildButton()
  }

  private updateBuildButton() {
    if (!this.buildPanel) return
    this.buildPanel.setVisible(this.sideLayout || this.buildOpen)
    this.buildBlocker.setVisible(this.buildOpen)
    if (this.buildOpen) this.buildBlocker.setInteractive({ useHandCursor: true })
    else this.buildBlocker.disableInteractive()
    this.buildButton.setVisible(!this.sideLayout && !this.buildOpen)
    this.leaveButton.setVisible(!this.buildOpen)
  }

  // The build panel marks the slot that the hovered weapon card would upgrade or replace.
  private syncHighlight() {
    const director = this.ctx.director
    const card = this.hovered >= 0 ? this.stock[this.hovered] : undefined
    const relation = card && director ? weaponRelation(director.build, card) : null
    this.buildPanel?.setHighlight(relation && relation.kind !== 'none' ? { slot: relation.slot, kind: relation.kind } : null)
  }

  private toggleFromKey() {
    if (this.hovered >= 0) {
      if (this.detailIndex === this.hovered) this.hideDetails()
      else this.showDetails(this.hovered, true)
    } else if (this.detailIndex >= 0) this.hideDetails()
  }

  private showDetails(index: number, pinned: boolean) {
    this.detailIndex = index
    this.pinned = pinned
    this.renderPanel()
  }

  private hideDetails() {
    this.detailIndex = -1
    this.pinned = false
    this.note?.hide()
    this.hint?.setVisible(true)
  }

  private renderPanel() {
    const card = this.stock[this.detailIndex]
    const build = this.ctx.director?.build
    if (!card || !build || !this.view) return
    const view = this.cards[this.detailIndex]
    const margin = Math.max(6, this.view.height * 0.025)
    this.note.show(card, build, this.ctx.bindings, {
      anchorX: view.x,
      width: Math.min(this.areaW - 16, view.w * 2.4),
      left: this.areaX + 8,
      right: this.areaX + this.areaW - 8,
      top: this.stripTop,
      bottom: this.view.height - margin,
    })
    this.hint.setVisible(false)
  }
}
