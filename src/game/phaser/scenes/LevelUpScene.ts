import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { PlayerWeaponId, PowerUpCard } from '../../contracts/progression'
import { hashString } from '../../contracts/rng'
import { weaponName, weaponRelation, type WeaponRelation } from '../../model/progression'
import { CARD_HEIGHT, CARD_WIDTH, glowTexture } from '../art'
import { cssColor } from '../color'
import type { View } from '../view'
import { BuildPanel } from './BuildPanel'
import { CardNote, createCardFace, fitText, showCardOn, sizeCardFace, type CardFace } from './cardFace'
import type { RunContext } from './context'
import { addButton, addText, type Button, onCanvasKey, onClick, overlayView } from './ui'

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
// From this view width on the build panel sits left of the cards. Narrower views (phones and
// tablets in portrait show 480 units) hide it behind a button and a key.
const SIDE_PANEL_MIN_WIDTH = 600
const BUILD_KEY = 'KeyB'
const NO_RELATION: WeaponRelation = { kind: 'none' }

interface CardView {
  face: CardFace
  // Fixed hit area at the slot, so a card that lifts under the pointer does not flicker.
  zone: Phaser.GameObjects.Zone
  // Outline, ribbon and tag of a weapon card that upgrades or replaces the weapon in its slot.
  ring: Phaser.GameObjects.Graphics
  ribbon: Phaser.GameObjects.Text
  tag: Phaser.GameObjects.Text
  relation: WeaponRelation
  // Slot centre and size, set by layout.
  x: number
  y: number
  w: number
  h: number
  tilt: number
  phase: number
  hover: number
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
  private note!: CardNote
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
  // The space the cards and their texts share. The build panel takes the left of the view in the
  // side layout.
  private areaX = 0
  private areaW = 0
  private sideLayout = false
  private buildPanel!: BuildPanel
  private buildButton!: Button
  // Closes the offer without a card, for a player who wants none of them.
  private skipButton!: Button
  private buildBlocker!: Phaser.GameObjects.Rectangle
  private buildOpen = false

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
    this.buildOpen = false
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
    this.note = new CardNote(this)
    this.buildBlocker = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0.6).setOrigin(0, 0).setVisible(false)
    onClick(this, this.buildBlocker, () => this.setBuildOpen(false))
    this.buildPanel = new BuildPanel(this)
    this.buildButton = addButton(this, 'Your build (B)', 76, 14, () => this.setBuildOpen(!this.buildOpen))
    this.buildButton.setVisible(false)
    this.skipButton = addButton(this, 'Skip', 40, 14, () => this.choose(null))
    this.skipButton.setVisible(false)
    onCanvasKey(this, (code, event) => {
      if (code === 'Tab') event.preventDefault()
      if (this.locked) return
      if (code === BUILD_KEY && !this.sideLayout) {
        this.setBuildOpen(!this.buildOpen)
        return
      }
      if (this.buildOpen) {
        if (code === 'Escape') this.setBuildOpen(false)
        return
      }
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
    this.buildPanel.pulse(this.clock)
    if (!this.locked && this.hovered >= 0 && this.detailIndex !== this.hovered) {
      this.hoverMs += delta
      if (this.hoverMs >= HOVER_DETAILS_MS) this.showDetails(this.hovered, false)
    }
  }

  private createCard(index: number, glowKey: string): CardView {
    const ring = this.add.graphics().setVisible(false)
    const ribbon = addText(this, 'UPGRADE', 6.5, { color: PALETTE.navy, bold: true, align: 'center' }).setOrigin(0.5).setVisible(false)
    const tag = addText(this, '', 5.8, { align: 'center' }).setOrigin(0.5, 0).setStroke(NAVY, 2).setVisible(false)
    const face = createCardFace(this, glowKey, String(index + 1), [ring, ribbon, tag])
    const zone = this.add.zone(0, 0, 1, 1)
    zone.on('pointerover', () => {
      if (this.locked) return
      this.hovered = index
      this.hoverMs = 0
      this.syncHighlight()
    })
    zone.on('pointerout', () => {
      if (this.hovered === index) this.hovered = -1
      this.syncHighlight()
      if (this.detailIndex === index && !this.pinned) this.hideDetails()
    })
    onClick(this, zone, () => this.choose(index), CHOOSE_BUTTON)
    return { face, zone, ring, ribbon, tag, relation: NO_RELATION, x: 0, y: 0, w: 1, h: 1, tilt: 0, phase: 0, hover: 0 }
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
    this.syncHighlight()
    this.setBuildOpen(false)
    this.buildPanel.setBuild(director.build)
    this.locked = true
    this.introMs = 0
    this.sparkNext = 0
    this.introEnd = CARD_START + (this.offer.length - 1) * CARD_STEP + CARD_MS
    this.offer.forEach((card, i) => {
      const view = this.cards[i]
      showCardOn(this, view.face, card, i / MAX_CARDS)
      view.tilt = ((hashString(card.id) % 1001) / 500 - 1) * TILT
      view.phase = (hashString(card.id) % 628) / 100
      view.hover = 0
      view.relation = weaponRelation(director.build, card)
    })
    this.layout()
    this.playIntro()
    this.updateBuildButton()
  }

  // null skips the offer.
  private choose(index: number | null) {
    if (this.locked || this.offer.length === 0) return
    const card = index === null ? null : this.offer[index]
    if (card === undefined) return
    this.offer = []
    this.hideDetails()
    this.hovered = -1
    this.syncHighlight()
    this.updateBuildButton()
    for (const view of this.cards) view.face.box.setVisible(false)
    this.ctx.gameplay?.chooseCard(card ? card.id : null)
    if (this.ctx.director && this.ctx.director.pendingLevelUps > 0) this.nextOffer()
  }

  // Plays the part of the intro that is due at introMs: dim, title, sparkles and the flying cards.
  private playIntro() {
    const t = this.introMs
    this.dim.setAlpha(Math.min(1, t / DIM_MS))
    if (this.sideLayout) this.buildPanel.setAlpha(this.dim.alpha)
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
    this.buildPanel.setAlpha(1)
    this.enableInput()
    this.updateBuildButton()
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
    const face = view.face
    if (p <= 0) {
      face.box.setVisible(false)
      return
    }
    const e = p >= 1 ? 1 : Phaser.Math.Easing.Back.Out(p)
    const bob = Math.sin(this.clock / 650 + view.phase) * view.h * 0.012
    const wobble = Math.sin(p * Math.PI * 4) * (1 - p) * 0.1
    const rotation = view.tilt * (1 - view.hover) + wobble
    // Rotated Text objects render with their lower part cut off, so the texts are turned back
    // upright. The tilt is a few degrees, so they still sit on the card.
    for (const text of face.texts) text.setRotation(-rotation)
    face.box
      .setVisible(true)
      .setPosition(view.x, view.y + (1 - e) * view.h * 0.9 + bob * p - view.hover * view.h * 0.04)
      .setRotation(rotation)
      .setScale((0.9 + 0.1 * e) * (1 + 0.07 * view.hover))
      .setAlpha(Math.min(1, p * 4))
    if (face.glow.visible) face.glow.setAlpha(0.55 + 0.3 * Math.sin(this.clock / 260))
    if (view.ring.visible) view.ring.setAlpha(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.clock / 170 + view.phase)))
  }

  private layout() {
    if (!this.view) return
    const { width: w, height: h } = this.view
    this.dim.setSize(w, h)
    this.buildBlocker.setSize(w, h)
    const margin = Math.max(6, h * 0.025)
    this.layoutBuildPanel(w, h, margin)
    const n = this.offer.length
    if (n === 0) return
    const areaW = this.areaW
    const gap = areaW * 0.02
    const head = 46
    const strip = Math.max(54, h * 0.2)
    // A card needs room for its lift, bob, hover scale and tilt, about a tenth of its height on
    // each side.
    const room = h - margin * 2 - head - strip - 14
    let cardW = (areaW - 16 - gap * (n - 1)) / n
    let cardH = (cardW * CARD_HEIGHT) / CARD_WIDTH
    if (cardH * 1.2 > room) {
      cardH = room / 1.2
      cardW = (cardH * CARD_WIDTH) / CARD_HEIGHT
    }
    const stack = head + 6 + cardH * 1.2 + 8 + strip
    const top = margin + (h - margin * 2 - stack) / 2
    const cardsTop = top + head + 6 + cardH * 0.1
    const centre = this.areaX + areaW / 2
    const left = centre - (n * cardW + (n - 1) * gap) / 2
    this.title.setPosition(centre, top + 14)
    this.subtitle.setPosition(centre, top + 36)
    this.stripTop = top + head + 6 + cardH * 1.2 + 8
    this.hint.setPosition(centre, this.stripTop + 4).setWordWrapWidth(areaW - 24)
    if (!this.sideLayout) this.buildButton.setPosition(8 + 38, top + 14)
    this.skipButton.setPosition(this.areaX + areaW - 8 - 20, top + 14)
    for (let i = 0; i < n; i++) {
      const view = this.cards[i]
      const card = this.offer[i]
      view.x = left + cardW / 2 + i * (cardW + gap)
      view.y = cardsTop + cardH / 2
      view.w = cardW
      view.h = cardH
      view.zone.setPosition(view.x, view.y).setSize(cardW, cardH)
      const s = sizeCardFace(view.face, card, cardW)
      if (s > 0) this.decorateCard(view, s)
    }
    this.enableInput()
    if (this.detailIndex >= 0) this.renderPanel()
  }

  // The side layout puts the build panel left of the cards and gives them the rest. The narrow
  // layout gives them the whole view and shows the panel as an overlay on request.
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
      this.buildPanel.place(0, 0, Math.min(w - 16, 340), 11)
      this.buildPanel.moveTo((w - Math.min(w - 16, 340)) / 2, Math.max(margin, (h - this.buildPanel.height) / 2))
    }
    this.updateBuildButton()
  }

  // Shows the panel as an overlay on narrow views. The side layout always shows it.
  private setBuildOpen(open: boolean) {
    const next = open && !this.sideLayout && !this.locked
    this.buildOpen = next
    this.updateBuildButton()
  }

  private updateBuildButton() {
    if (!this.buildPanel) return
    const side = this.sideLayout
    this.buildPanel.setVisible(side || this.buildOpen)
    this.buildBlocker.setVisible(this.buildOpen)
    if (this.buildOpen) this.buildBlocker.setInteractive({ useHandCursor: true })
    else this.buildBlocker.disableInteractive()
    this.buildButton.setVisible(!side && !this.locked && this.offer.length > 0 && !this.buildOpen)
    this.skipButton.setVisible(!this.locked && this.offer.length > 0 && !this.buildOpen)
  }

  // The card's own marks: the ribbon and outline of an upgrade and the tag of a replacement.
  // Drawn when the offer or the size changes, never per frame.
  private decorateCard(view: CardView, s: number) {
    const { relation } = view
    const upgrade = relation.kind === 'upgrade'
    view.ring.clear().setVisible(upgrade)
    view.ribbon.setVisible(upgrade)
    if (upgrade) {
      const w = view.w
      const h = view.h
      view.ring.lineStyle(Math.max(2, 3 * s), PALETTE.teal, 1).strokeRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2)
      view.ring.lineStyle(Math.max(1, 1.2 * s), PALETTE.yellow, 1).strokeRect(-w / 2 - 4 * s, -h / 2 - 4 * s, w + 8 * s, h + 8 * s)
      view.ribbon
        .setFontSize(6.5 * s)
        .setBackgroundColor(cssColor(PALETTE.yellow))
        .setPadding(4 * s, 1.5 * s, 4 * s, 1.5 * s)
        .setPosition(0, -h / 2)
    }
    const tag = relation.kind === 'none' ? '' : relation.kind === 'upgrade' ? `Becomes ${this.upgradeName(view)}` : `Replaces ${relation.currentName}`
    view.tag.setVisible(tag !== '')
    if (tag === '') return
    view.tag.setPosition(0, view.h / 2 + 3 * s).setColor(cssColor(upgrade ? PALETTE.yellow : PALETTE.cream))
    fitText(view.tag, tag, view.w * 1.05, 14 * s, 5.8 * s, 4.2 * s)
  }

  private upgradeName(view: CardView): string {
    const card = this.offer[this.cards.indexOf(view)]
    return weaponName(card.id.slice('weapon.'.length) as PlayerWeaponId, 2)
  }

  // The build panel marks the slot that the hovered weapon card would upgrade or replace.
  private syncHighlight() {
    const relation = this.hovered >= 0 && this.hovered < this.offer.length ? this.cards[this.hovered].relation : NO_RELATION
    this.buildPanel?.setHighlight(relation.kind === 'none' ? null : { slot: relation.slot, kind: relation.kind })
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
    this.note.hide()
    this.hint.setVisible(true)
  }

  // Drawn when it opens and when the view changes, never per frame.
  private renderPanel() {
    const card = this.offer[this.detailIndex]
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
