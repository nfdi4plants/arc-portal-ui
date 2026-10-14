import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { Action } from '../../contracts/input'
import type { PowerUpCard } from '../../contracts/progression'
import { hashString } from '../../contracts/rng'
import { bindingLabel } from '../../model/input'
import { cardDetails } from '../../model/progression'
import { applySpriteRef, CARD_HEIGHT, CARD_WIDTH, cardArt, glowTexture, RARITY_COLOR } from '../art'
import { cssColor } from '../color'
import type { View } from '../view'
import type { RunContext } from './context'
import { addText, onCanvasKey, onClick, overlayView } from './ui'

const MAX_CARDS = 4
// Mouse button that chooses a card (0 left, 2 right).
const CHOOSE_BUTTON: 0 | 2 = 0
const CHOOSE_HINT = `${CHOOSE_BUTTON === 0 ? 'Click' : 'Right-click'} a card to choose it · hover for details`
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

// Intro timeline in ms. Every input is ignored until the last card has landed.
const DIM_MS = 250
const TITLE_START = 60
const TITLE_MS = 380
const SPARK_START = 140
const SPARK_STEP = 60
const CARD_START = 300
const CARD_STEP = 90
const CARD_MS = 330
const HOVER_DETAILS_MS = 600
const TILT = (4 * Math.PI) / 180
// Where the sparkles burst, as fractions of the title's half width and of its height.
const SPARKS: readonly (readonly [number, number])[] = [[-1.15, 0.1], [1.1, 0], [-0.6, -0.9], [0.65, -0.8], [0.05, -1.2]]

const NAVY = cssColor(PALETTE.navy)

interface CardView {
  box: Phaser.GameObjects.Container
  texts: Phaser.GameObjects.Text[]
  glow: Phaser.GameObjects.Image
  art: Phaser.GameObjects.Sprite
  name: Phaser.GameObjects.Text
  description: Phaser.GameObjects.Text
  meta: Phaser.GameObjects.Text
  key: Phaser.GameObjects.Text
  // Fixed hit area at the slot, so a card that lifts under the pointer does not flicker.
  zone: Phaser.GameObjects.Zone
  // Slot centre and size, set by layout.
  x: number
  y: number
  w: number
  h: number
  tilt: number
  phase: number
  hover: number
  // Skips the text fitting when neither the card nor its size changed.
  fitKey: string
}

function fitText(text: Phaser.GameObjects.Text, content: string, width: number, height: number, maxSize: number, minSize: number): void {
  text.setWordWrapWidth(width).setText(content)
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    text.setFontSize(size)
    if (text.height <= height) return
  }
  const words = content.split(' ')
  while (words.length > 1 && text.height > height) {
    words.pop()
    text.setText(`${words.join(' ')}...`)
  }
}

// One card choice per level gained, one after the other. The gameplay scene stays held until the
// last choice. A card is chosen by a click or the keys 1 to 4, and only after the intro.
export class LevelUpScene extends Phaser.Scene {
  private readonly ctx: RunContext
  private view!: View
  private dim!: Phaser.GameObjects.Rectangle
  private title!: Phaser.GameObjects.Text
  private subtitle!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private sparks: Phaser.GameObjects.Sprite[] = []
  private sparkAnim = ''
  private sparkNext = 0
  private panel!: Phaser.GameObjects.Graphics
  private panelTitle!: Phaser.GameObjects.Text
  private panelBody!: Phaser.GameObjects.Text
  private panelFlavor!: Phaser.GameObjects.Text
  private cards: CardView[] = []
  private offer: PowerUpCard[] = []
  private locked = true
  private introMs = 0
  private introEnd = 0
  private clock = 0
  private hovered = -1
  private hoverMs = 0
  // Card whose detail panel is open, -1 for none. A pinned panel stays when the pointer leaves.
  private detailIndex = -1
  private pinned = false
  // Where the panel goes: the top of the strip under the cards and the card row's centre line.
  private stripTop = 0

  constructor(ctx: RunContext) {
    super(SCENE.levelUp)
    this.ctx = ctx
  }

  create() {
    this.offer = []
    this.cards = []
    this.sparks = []
    this.locked = true
    this.introMs = 0
    this.clock = 0
    this.hovered = -1
    this.detailIndex = -1
    this.pinned = false
    this.dim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.55).setOrigin(0, 0).setAlpha(0)
    const glowKey = glowTexture(this)
    this.cards = Array.from({ length: MAX_CARDS }, (_, i) => this.createCard(i, glowKey))
    this.title = addText(this, 'Level up!', 24, { color: PALETTE.yellow, bold: true }).setOrigin(0.5).setStroke(NAVY, 4)
    this.subtitle = addText(this, '', 8, { bold: true }).setOrigin(0.5)
    this.hint = addText(this, CHOOSE_HINT, 7, { align: 'center' }).setOrigin(0.5, 0).setStroke(NAVY, 2)
    this.sparkAnim = this.ctx.art.fx(this, 'levelUp')
    const unit = 1 / this.ctx.art.pixelsPerUnit
    this.sparks = Array.from({ length: SPARKS.length }, () => {
      const sprite = this.add.sprite(0, 0, '__DEFAULT').setScale(unit).setVisible(false)
      sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setVisible(false))
      return sprite
    })
    this.panel = this.add.graphics().setVisible(false)
    this.panelTitle = addText(this, '', 9, { color: PALETTE.navy, bold: true }).setVisible(false)
    this.panelBody = addText(this, '', 7.5, { color: PALETTE.navy }).setVisible(false)
    this.panelFlavor = addText(this, '', 7, { color: PALETTE.outline }).setFontStyle('italic').setVisible(false)
    onCanvasKey(this, (code, event) => {
      if (code === 'Tab') event.preventDefault()
      if (this.locked) return
      const index = KEYS[code]
      if (index !== undefined) this.choose(index)
      else if (code === 'Slash' || code === 'Tab' || event.key === '?') this.toggleFromKey()
    })
    overlayView(this, (view) => {
      this.view = view
      this.layout()
    })
    this.nextOffer()
  }

  update(_time: number, delta: number) {
    this.clock += delta
    if (this.locked) {
      this.introMs += delta
      this.playIntro()
      if (this.introMs >= this.introEnd) this.finishIntro()
    }
    const ease = Math.min(1, delta / 80)
    for (let i = 0; i < this.offer.length; i++) {
      const card = this.cards[i]
      card.hover += ((i === this.hovered && !this.locked ? 1 : 0) - card.hover) * ease
      this.poseCard(i)
    }
    if (!this.locked && this.hovered >= 0 && this.detailIndex !== this.hovered) {
      this.hoverMs += delta
      if (this.hoverMs >= HOVER_DETAILS_MS) this.showDetails(this.hovered, false)
    }
  }

  private createCard(index: number, glowKey: string): CardView {
    const glow = this.add.image(0, 0, glowKey).setTint(PALETTE.yellow).setVisible(false)
    const art = this.add.sprite(0, 0, '__DEFAULT')
    const name = addText(this, '', 8.5, { color: PALETTE.navy, bold: true, align: 'center' }).setOrigin(0.5)
    const description = addText(this, '', 7, { color: PALETTE.outline, align: 'center' }).setOrigin(0.5, 0)
    const meta = addText(this, '', 5.8, { color: PALETTE.navy, align: 'center' }).setOrigin(0.5)
    const key = addText(this, String(index + 1), 7.5, { color: PALETTE.navy, bold: true }).setOrigin(0.5)
    const box = this.add.container(0, 0, [glow, art, name, description, meta, key]).setVisible(false)
    const zone = this.add.zone(0, 0, 1, 1)
    zone.on('pointerover', () => {
      if (this.locked) return
      this.hovered = index
      this.hoverMs = 0
    })
    zone.on('pointerout', () => {
      if (this.hovered === index) this.hovered = -1
      if (this.detailIndex === index && !this.pinned) this.hideDetails()
    })
    onClick(this, zone, () => this.choose(index), CHOOSE_BUTTON)
    return { box, texts: [name, description, meta, key], glow, art, name, description, meta, key, zone, x: 0, y: 0, w: 1, h: 1, tilt: 0, phase: 0, hover: 0, fitKey: '' }
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
    this.subtitle.setText(`Level ${level} · pick a card`)
    this.hideDetails()
    this.hovered = -1
    this.locked = true
    this.introMs = 0
    this.sparkNext = 0
    this.introEnd = CARD_START + (this.offer.length - 1) * CARD_STEP + CARD_MS
    this.offer.forEach((card, i) => {
      const view = this.cards[i]
      applySpriteRef(view.art, cardArt(this, card.rarity, card.kind))
      view.art.setOrigin(0.5)
      view.art.anims.setProgress(i / MAX_CARDS)
      view.tilt = ((hashString(card.id) % 1001) / 500 - 1) * TILT
      view.phase = (hashString(card.id) % 628) / 100
      view.hover = 0
      view.fitKey = ''
      view.meta.setText(card.slot ? `${card.rarity} · ${card.slot}` : card.rarity)
      view.glow.setVisible(card.rarity === 'legendary')
    })
    this.layout()
    this.playIntro()
  }

  private choose(index: number) {
    if (this.locked) return
    const card = this.offer[index]
    if (!card) return
    this.offer = []
    this.hideDetails()
    this.hovered = -1
    for (const view of this.cards) view.box.setVisible(false)
    this.ctx.gameplay?.chooseCard(card.id)
    if (this.ctx.director && this.ctx.director.pendingLevelUps > 0) this.nextOffer()
  }

  // Plays the part of the intro that is due at introMs: dim, title, sparkles and the flying cards.
  private playIntro() {
    const t = this.introMs
    this.dim.setAlpha(Math.min(1, t / DIM_MS))
    const pop = Phaser.Math.Clamp((t - TITLE_START) / TITLE_MS, 0, 1)
    const scale = Phaser.Math.Easing.Back.Out(pop)
    this.title.setScale(scale).setRotation((1 - pop) * -0.18).setAlpha(Math.min(1, pop * 4))
    this.subtitle.setAlpha(Phaser.Math.Clamp((t - TITLE_START - 150) / 200, 0, 1))
    while (this.sparkNext < SPARKS.length && t >= SPARK_START + this.sparkNext * SPARK_STEP) {
      const [dx, dy] = SPARKS[this.sparkNext]
      this.sparks[this.sparkNext]
        .setPosition(this.title.x + dx * (this.title.width / 2 + 8), this.title.y + 16 + dy * 14)
        .setVisible(true)
        .play({ key: this.sparkAnim, repeat: 0 })
      this.sparkNext++
    }
    this.hint.setAlpha(this.locked ? Phaser.Math.Clamp((t - this.introEnd + 200) / 200, 0, 1) : 1)
  }

  private finishIntro() {
    this.locked = false
    this.dim.setAlpha(1)
    this.title.setScale(1).setRotation(0).setAlpha(1)
    this.subtitle.setAlpha(1)
    this.hint.setAlpha(1)
    this.enableInput()
  }

  private enableInput() {
    for (let i = 0; i < MAX_CARDS; i++) {
      const view = this.cards[i]
      // An interactive object keeps the hit area it was enabled with, so it is set up anew.
      view.zone.removeInteractive()
      if (this.locked || i >= this.offer.length) continue
      view.zone.setInteractive({ useHandCursor: true })
    }
  }

  // Idle bob, hover lift and the fly-in of one card. Only sets properties, nothing is allocated.
  private poseCard(i: number) {
    const view = this.cards[i]
    const p = this.locked ? Phaser.Math.Clamp((this.introMs - CARD_START - i * CARD_STEP) / CARD_MS, 0, 1) : 1
    if (p <= 0) {
      view.box.setVisible(false)
      return
    }
    const e = p >= 1 ? 1 : Phaser.Math.Easing.Back.Out(p)
    const bob = Math.sin(this.clock / 650 + view.phase) * view.h * 0.012
    const wobble = Math.sin(p * Math.PI * 4) * (1 - p) * 0.1
    const rotation = view.tilt * (1 - view.hover) + wobble
    // Rotated Text objects render with their lower part cut off, so the texts are turned back
    // upright. The tilt is a few degrees, so they still sit on the card.
    for (const text of view.texts) text.setRotation(-rotation)
    view.box
      .setVisible(true)
      .setPosition(view.x, view.y + (1 - e) * view.h * 0.9 + bob * p - view.hover * view.h * 0.04)
      .setRotation(rotation)
      .setScale((0.9 + 0.1 * e) * (1 + 0.07 * view.hover))
      .setAlpha(Math.min(1, p * 4))
    if (view.glow.visible) view.glow.setAlpha(0.55 + 0.3 * Math.sin(this.clock / 260))
  }

  private layout() {
    if (!this.view) return
    const { width: w, height: h } = this.view
    this.dim.setSize(w, h)
    const n = this.offer.length
    if (n === 0) return
    const gap = w * 0.02
    const margin = Math.max(6, h * 0.025)
    const head = 46
    const strip = Math.max(54, h * 0.2)
    // A card needs room for its lift, bob, hover scale and tilt, about a tenth of its height on
    // each side.
    const room = h - margin * 2 - head - strip - 14
    let cardW = (w - 16 - gap * (n - 1)) / n
    let cardH = (cardW * CARD_HEIGHT) / CARD_WIDTH
    if (cardH * 1.2 > room) {
      cardH = room / 1.2
      cardW = (cardH * CARD_WIDTH) / CARD_HEIGHT
    }
    const stack = head + 6 + cardH * 1.2 + 8 + strip
    const top = margin + (h - margin * 2 - stack) / 2
    const cardsTop = top + head + 6 + cardH * 0.1
    const left = (w - (n * cardW + (n - 1) * gap)) / 2
    this.title.setPosition(w / 2, top + 14)
    this.subtitle.setPosition(w / 2, top + 36)
    this.stripTop = top + head + 6 + cardH * 1.2 + 8
    this.hint.setPosition(w / 2, this.stripTop + 4).setWordWrapWidth(w - 24)
    const s = cardW / CARD_WIDTH
    const local = (x: number, y: number): [number, number] => [(x - CARD_WIDTH / 2) * s, (y - CARD_HEIGHT / 2) * s]
    for (let i = 0; i < n; i++) {
      const view = this.cards[i]
      const card = this.offer[i]
      view.x = left + cardW / 2 + i * (cardW + gap)
      view.y = cardsTop + cardH / 2
      view.w = cardW
      view.h = cardH
      view.art.setDisplaySize(cardW, cardH)
      view.glow.setDisplaySize(cardW * 1.7, cardH * 1.5)
      view.zone.setPosition(view.x, view.y).setSize(cardW, cardH)
      view.name.setPosition(...local(50, 16.5))
      view.description.setPosition(...local(50, 67))
      view.meta.setPosition(...local(50, 126))
      view.key.setPosition(...local(14, 126))
      const fitKey = `${card.id}:${Math.round(cardW * 4)}`
      if (view.fitKey !== fitKey) {
        view.fitKey = fitKey
        fitText(view.name, card.name, 84 * s, 22 * s, 8.5 * s, 5.5 * s)
        fitText(view.description, card.description, 82 * s, 46 * s, 7 * s, 4.8 * s)
        view.meta.setFontSize(5.8 * s)
        view.key.setFontSize(7.5 * s)
      }
    }
    this.enableInput()
    if (this.detailIndex >= 0) this.renderPanel()
  }

  private toggleDetails(index: number) {
    if (this.locked) return
    if (this.detailIndex === index) this.hideDetails()
    else this.showDetails(index, true)
  }

  private toggleFromKey() {
    if (this.hovered >= 0) this.toggleDetails(this.hovered)
    else if (this.detailIndex >= 0) this.hideDetails()
  }

  private showDetails(index: number, pinned: boolean) {
    this.detailIndex = index
    this.pinned = pinned
    this.renderPanel()
  }

  private hideDetails() {
    this.detailIndex = -1
    this.pinned = false
    this.panel.setVisible(false)
    this.panelTitle.setVisible(false)
    this.panelBody.setVisible(false)
    this.panelFlavor.setVisible(false)
    this.hint.setVisible(true)
  }

  // Drawn when it opens and when the view changes, never per frame.
  private renderPanel() {
    const card = this.offer[this.detailIndex]
    const build = this.ctx.director?.build
    if (!card || !build || !this.view) return
    const lines = cardDetails(build, card.id, (slot) => {
      const binding = this.ctx.bindings[`ability${slot + 1}` as Action][0]
      return binding ? bindingLabel(binding) : `slot ${slot + 1}`
    })
    const flavor = lines.pop() ?? ''
    const { width: w, height: h } = this.view
    const view = this.cards[this.detailIndex]
    const panelW = Math.min(w - 16, view.w * 2.4)
    const pad = 6
    const inner = panelW - pad * 2
    const x = Phaser.Math.Clamp(view.x - panelW / 2, 8, w - 8 - panelW)
    const margin = Math.max(6, h * 0.025)
    const y0 = this.stripTop
    const room = h - margin - y0 - pad * 2
    this.panelTitle.setText(card.name).setWordWrapWidth(inner)
    const body = lines.join('\n')
    let size = 7.5
    for (; size >= 5.5; size -= 0.5) {
      this.panelBody.setWordWrapWidth(inner).setFontSize(size).setText(body)
      this.panelFlavor.setWordWrapWidth(inner).setFontSize(size - 0.5).setText(flavor)
      if (this.panelTitle.height + 2 + this.panelBody.height + 3 + this.panelFlavor.height <= room) break
    }
    const height = pad * 2 + this.panelTitle.height + 2 + this.panelBody.height + 3 + this.panelFlavor.height
    const y = Math.min(y0, h - margin - height)
    this.panelTitle.setPosition(x + pad, y + pad)
    this.panelBody.setPosition(x + pad, this.panelTitle.y + this.panelTitle.height + 2)
    this.panelFlavor.setPosition(x + pad, this.panelBody.y + this.panelBody.height + 3)
    this.drawPanel(x, y, panelW, height, RARITY_COLOR[card.rarity])
    for (const part of [this.panel, this.panelTitle, this.panelBody, this.panelFlavor]) part.setVisible(true)
    this.hint.setVisible(false)
  }

  // A paper note with a hand-drawn double outline.
  private drawPanel(x: number, y: number, w: number, h: number, color: number) {
    const g = this.panel
    g.clear().fillStyle(0xfffdf6, 1).fillRect(x, y, w, h).fillStyle(color, 1).fillRect(x, y, w, 3)
    const jitter = () => (Math.random() - 0.5) * 1.6
    for (let pass = 0; pass < 2; pass++) {
      g.lineStyle(pass === 0 ? 1.4 : 0.8, PALETTE.outline, pass === 0 ? 1 : 0.6)
      const corners = [x, y, x + w, y, x + w, y + h, x, y + h]
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4
        g.lineBetween(corners[k * 2] + jitter(), corners[k * 2 + 1] + jitter(), corners[next * 2] + jitter(), corners[next * 2 + 1] + jitter())
      }
    }
  }
}
