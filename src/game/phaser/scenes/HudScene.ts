import Phaser from 'phaser'
import { PALETTE, SCENE } from '../../contracts/constants'
import type { Action } from '../../contracts/input'
import { bindingLabel } from '../../model/input'
import { xpForNextLevel } from '../../model/progression'
import type { View } from '../view'
import type { MonsterSpec } from '../../contracts/content'
import type { Segment } from '../../contracts/run'
import type { HudControl, RunContext } from './context'
import { LevelHistoryPanel } from './LevelHistoryPanel'
import { MobInfoPanel } from './MobInfoPanel'
import { MOB_INFO_EVENT } from './mobInfoEvent'
import { addButton, addText, overlayView, type Button } from './ui'

const M = 8
const SLOT_W = 34
const SLOT_H = 22
const SLOT_GAP = 4
const ABILITIES: readonly Action[] = ['ability1', 'ability2', 'ability3', 'ability4']
// Cooldown overlays redraw in this many steps, not every frame.
const COOLDOWN_STEPS = 16
const HP_COLOR = 0xd9534f
const ATTACK_COLOR = 0xb3261e
const BANNER_FADE_MS = 300

function slotName(id: string | null): string {
  return id ? id.replace(/([A-Z])/g, ' $1').toLowerCase() : ''
}

// Runs over the gameplay scenes for the whole run. Every element redraws only when the value it
// shows has changed.
export class HudScene extends Phaser.Scene implements HudControl {
  private readonly ctx: RunContext
  private view!: View
  private bars!: Phaser.GameObjects.Graphics
  private hpText!: Phaser.GameObjects.Text
  private levelText!: Phaser.GameObjects.Text
  private slotsGraphics!: Phaser.GameObjects.Graphics
  private keyTexts: Phaser.GameObjects.Text[] = []
  private nameTexts: Phaser.GameObjects.Text[] = []
  private pathGraphics!: Phaser.GameObjects.Graphics
  private bossGraphics!: Phaser.GameObjects.Graphics
  private bossText!: Phaser.GameObjects.Text
  private attackText!: Phaser.GameObjects.Text
  private bannerBox!: Phaser.GameObjects.Graphics
  private bannerTitle!: Phaser.GameObjects.Text
  private bannerSubtitle!: Phaser.GameObjects.Text
  private bannerMs = 0
  private pauseDim!: Phaser.GameObjects.Rectangle
  private pauseTitle!: Phaser.GameObjects.Text
  private pauseButtons: Button[] = []
  private mobInfo!: MobInfoPanel
  private history!: LevelHistoryPanel
  private paused = false

  // Last drawn values. NaN forces a redraw.
  private hp = NaN
  private maxHp = NaN
  private shields = NaN
  private xp = NaN
  private level = NaN
  private nodeIndex = NaN
  private bossFill = NaN
  private bossName: string | null = null
  private attackName: string | null = null
  private bindingsVersion = NaN
  private readonly slotIds: (string | null | undefined)[] = [undefined, undefined, undefined, undefined]
  private readonly slotFill = [NaN, NaN, NaN, NaN]
  private readonly slotCharged = [true, true, true, true]
  private readonly cooldownTotal = [0, 0, 0, 0]

  constructor(ctx: RunContext) {
    super(SCENE.hud)
    this.ctx = ctx
  }

  create() {
    // The scene object outlives a restart, so the cached values start over here.
    this.hp = this.maxHp = this.shields = this.xp = this.level = this.nodeIndex = this.bossFill = this.bindingsVersion = NaN
    this.bossName = this.attackName = null
    this.slotIds.fill(undefined)
    this.slotFill.fill(NaN)
    this.slotCharged.fill(true)
    this.cooldownTotal.fill(0)
    this.bars = this.add.graphics()
    this.hpText = addText(this, '', 6, { bold: true }).setOrigin(0.5)
    this.levelText = addText(this, '', 7, { color: PALETTE.navy, bold: true })
    this.slotsGraphics = this.add.graphics()
    this.keyTexts = ABILITIES.map(() => addText(this, '', 6, { bold: true }))
    this.nameTexts = ABILITIES.map(() => addText(this, '', 5, { align: 'center', wrap: SLOT_W - 4 }).setOrigin(0.5, 1))
    this.pathGraphics = this.add.graphics()
    this.bossGraphics = this.add.graphics()
    this.bossText = addText(this, '', 8, { color: PALETTE.navy, bold: true }).setOrigin(0.5, 0)
    this.attackText = addText(this, '', 7, { color: ATTACK_COLOR, bold: true }).setOrigin(0.5, 0)
    this.bannerBox = this.add.graphics()
    this.bannerTitle = addText(this, '', 12, { bold: true, align: 'center' }).setOrigin(0.5, 0)
    this.bannerSubtitle = addText(this, '', 8, { align: 'center' }).setOrigin(0.5, 0)
    // The visible dim is drawn by the gameplay scene, under the mob the player inspects. This one
    // stays invisible and only marks the pause.
    this.pauseDim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, 0).setOrigin(0, 0)
    this.pauseTitle = addText(this, 'Paused', 16, { bold: true }).setOrigin(0.5)
    this.pauseButtons = [
      addButton(this, 'Resume', 130, 22, () => this.ctx.gameplay?.resumeFromPause()),
      addButton(this, 'Level-up provenance', 130, 22, () => this.openHistory()),
      addButton(this, 'Quit to menu', 130, 22, () => this.ctx.quitToMenu()),
    ]
    this.paused = false
    this.mobInfo = new MobInfoPanel(this, () => this.syncMenu())
    this.history = new LevelHistoryPanel(this, () => this.closeHistory())
    const onMobInfo = (spec?: MonsterSpec, segment?: Segment, focusY?: number) => {
      if (spec && segment && this.paused && !this.history.isOpen()) this.mobInfo.show(spec, segment, focusY)
      else this.mobInfo.hide()
    }
    this.game.events.on(MOB_INFO_EVENT, onMobInfo)
    this.bannerMs = 0
    this.setBannerAlpha(0)
    this.showPause(false)

    overlayView(this, (view) => this.layout(view))
    this.ctx.hud = this
    this.events.once('shutdown', () => {
      this.game.events.off(MOB_INFO_EVENT, onMobInfo)
      if (this.ctx.hud === this) this.ctx.hud = null
    })
  }

  private layout(view: View) {
    this.view = view
    const { width: w, height: h } = view
    this.levelText.setPosition(M, M + 19)
    this.bossText.setPosition(w / 2, M + 12)
    this.attackText.setPosition(w / 2, M + 34)
    this.bannerTitle.setPosition(w / 2, h * 0.24)
    this.bannerSubtitle.setPosition(w / 2, h * 0.24 + 18)
    this.pauseDim.setSize(w, h)
    this.pauseTitle.setPosition(w / 2, h / 2 - 48)
    this.pauseButtons[0].setPosition(w / 2, h / 2 - 14)
    this.pauseButtons[1].setPosition(w / 2, h / 2 + 14)
    this.pauseButtons[2].setPosition(w / 2, h / 2 + 42)
    this.mobInfo.layout(view)
    this.history.layout(view)
    for (let i = 0; i < ABILITIES.length; i++) {
      const x = M + i * (SLOT_W + SLOT_GAP)
      const y = h - M - SLOT_H
      this.keyTexts[i].setPosition(x + 2, y + 1)
      this.nameTexts[i].setPosition(x + SLOT_W / 2, y + SLOT_H - 1)
    }
    if (this.bannerMs > 0) this.drawBannerBox()
    this.hp = this.maxHp = this.xp = this.nodeIndex = this.bossFill = NaN
    this.bossName = null
    this.slotFill.fill(NaN)
  }

  private barWidth(): number {
    return Math.min(150, this.view.width * 0.3)
  }

  showBanner(title: string, subtitle: string, ms: number) {
    this.bannerTitle.setText(title)
    this.bannerSubtitle.setText(subtitle)
    this.bannerMs = ms
    this.setBannerAlpha(1)
    this.drawBannerBox()
  }

  // Title and subtitle wrap at the widest box the view allows, measured anew for every banner.
  // The box grows with their height.
  private drawBannerBox() {
    const maxWidth = this.view.width - 2 * M
    this.bannerTitle.setWordWrapWidth(maxWidth - 24, true)
    this.bannerSubtitle.setWordWrapWidth(maxWidth - 24, true)
    const width = Math.min(maxWidth, Math.max(this.bannerTitle.width, this.bannerSubtitle.width) + 24)
    const top = this.bannerTitle.y - 6
    this.bannerSubtitle.setY(this.bannerTitle.y + this.bannerTitle.height + 2)
    const height = this.bannerSubtitle.y + this.bannerSubtitle.height + 6 - top
    this.bannerBox.clear().fillStyle(PALETTE.navy, 0.88).fillRoundedRect(this.view.width / 2 - width / 2, top, width, height, 4)
  }

  private setBannerAlpha(alpha: number) {
    this.bannerBox.setAlpha(alpha)
    this.bannerTitle.setAlpha(alpha)
    this.bannerSubtitle.setAlpha(alpha)
  }

  showPause(visible: boolean) {
    this.paused = visible
    this.pauseDim.setVisible(visible)
    if (!visible) {
      this.mobInfo.hide()
      this.history.hide()
    }
    this.syncMenu()
  }

  // The title and buttons make room while a panel is open, so a panel never covers a button.
  private syncMenu() {
    const shown = this.paused && !this.mobInfo.isOpen() && !this.history.isOpen()
    this.pauseTitle.setVisible(shown)
    for (const button of this.pauseButtons) button.setVisible(shown)
  }

  private openHistory() {
    this.mobInfo.hide()
    this.history.show(this.ctx.director?.levelHistory ?? [])
    this.syncMenu()
  }

  private closeHistory() {
    this.history.hide()
    this.syncMenu()
  }

  update(_time: number, delta: number) {
    // The gameplay scene holds its banner time during the pause, so the banner waits with it.
    if (this.bannerMs > 0 && !this.pauseDim.visible) {
      this.bannerMs -= delta
      this.setBannerAlpha(Math.max(0, Math.min(1, this.bannerMs / BANNER_FADE_MS)))
    }
    const director = this.ctx.director
    const active = this.ctx.active
    if (!director || !active || !this.view) return
    const { player, loadout, boss } = active
    const build = director.build

    const hp = Math.ceil(player.hp())
    const shields = player.shieldCount()
    if (hp !== this.hp || build.stats.maxHp !== this.maxHp || shields !== this.shields || build.xp !== this.xp || build.level !== this.level) {
      this.hp = hp
      this.maxHp = build.stats.maxHp
      this.shields = shields
      this.xp = build.xp
      this.level = build.level
      this.drawBars()
    }

    let slotsChanged = this.bindingsVersion !== this.ctx.bindingsVersion
    for (let i = 0; i < ABILITIES.length; i++) {
      const id = build.abilitySlots[i] ?? null
      const remaining = player.abilityCooldownRemainingMs(i)
      if (remaining <= 0) this.cooldownTotal[i] = 0
      else if (remaining > this.cooldownTotal[i]) this.cooldownTotal[i] = remaining
      const fill = this.cooldownTotal[i] > 0 ? Math.ceil((remaining / this.cooldownTotal[i]) * COOLDOWN_STEPS) : 0
      const charged = id === 'gitRevert' ? loadout.gitRevertCharged() : true
      if (id !== this.slotIds[i] || fill !== this.slotFill[i] || charged !== this.slotCharged[i]) {
        this.slotIds[i] = id
        this.slotFill[i] = fill
        this.slotCharged[i] = charged
        slotsChanged = true
      }
    }
    if (slotsChanged) this.drawSlots()

    const nodeIndex = director.currentNodeIndex()
    if (nodeIndex !== this.nodeIndex) {
      this.nodeIndex = nodeIndex
      this.drawPath(director.plan.nodes.length)
    }

    const shown = boss !== null && boss.showHpBar()
    const bossFill = shown ? Math.ceil(boss.hpFraction() * 200) : -1
    const bossName = boss ? active.bossName : ''
    if (bossFill !== this.bossFill || bossName !== this.bossName) {
      this.bossFill = bossFill
      this.bossName = bossName
      this.drawBoss()
    }
    const attackName = boss?.currentAttackName() ?? null
    if (attackName !== this.attackName) {
      this.attackName = attackName
      this.attackText.setText(attackName ?? '')
    }
  }

  private drawBars() {
    const g = this.bars.clear()
    const w = this.barWidth()
    const fraction = this.maxHp > 0 ? Math.max(0, Math.min(1, this.hp / this.maxHp)) : 0
    g.fillStyle(PALETTE.navy, 0.9).fillRect(M, M, w, 10)
    g.fillStyle(HP_COLOR, 1).fillRect(M + 1, M + 1, (w - 2) * fraction, 8)
    for (let i = 0; i < this.shields; i++) {
      g.fillStyle(PALETTE.blue, 1).fillCircle(M + w + 8 + i * 9, M + 5, 3.5)
      g.lineStyle(1, PALETTE.navy, 1).strokeCircle(M + w + 8 + i * 9, M + 5, 3.5)
    }
    const need = xpForNextLevel(this.level)
    g.fillStyle(PALETTE.navy, 0.9).fillRect(M, M + 12, w, 4)
    g.fillStyle(PALETTE.yellow, 1).fillRect(M, M + 12, w * Math.min(1, this.xp / need), 4)
    this.hpText.setText(`${this.hp} / ${this.maxHp}`).setPosition(M + w / 2, M + 5)
    this.levelText.setText(`Level ${this.level}`)
  }

  private drawSlots() {
    this.bindingsVersion = this.ctx.bindingsVersion
    const g = this.slotsGraphics.clear()
    const y = this.view.height - M - SLOT_H
    for (let i = 0; i < ABILITIES.length; i++) {
      const x = M + i * (SLOT_W + SLOT_GAP)
      const id = this.slotIds[i] ?? null
      g.fillStyle(PALETTE.navy, id ? 0.9 : 0.5).fillRect(x, y, SLOT_W, SLOT_H)
      const cooldown = this.slotFill[i] / COOLDOWN_STEPS
      if (cooldown > 0) g.fillStyle(PALETTE.outline, 0.6).fillRect(x, y, SLOT_W, SLOT_H * cooldown)
      if (!this.slotCharged[i]) g.fillStyle(PALETTE.outline, 0.6).fillRect(x, y, SLOT_W, SLOT_H)
      g.lineStyle(1, id && this.slotCharged[i] ? PALETTE.yellow : PALETTE.cream, 1).strokeRect(x, y, SLOT_W, SLOT_H)
      const binding = this.ctx.bindings[ABILITIES[i]][0]
      this.keyTexts[i].setText(binding ? bindingLabel(binding) : '')
      this.nameTexts[i].setText(slotName(id))
    }
  }

  private drawPath(count: number) {
    const g = this.pathGraphics.clear()
    const spacing = Math.min(14, (this.view.width * 0.3) / Math.max(1, count))
    const left = this.view.width / 2 - (spacing * (count - 1)) / 2
    for (let i = 0; i < count; i++) {
      const x = left + i * spacing
      if (i < this.nodeIndex) g.fillStyle(PALETTE.teal, 1).fillCircle(x, M + 4, 3)
      else if (i === this.nodeIndex) g.fillStyle(PALETTE.yellow, 1).fillCircle(x, M + 4, 4.5)
      g.lineStyle(1, PALETTE.navy, 1).strokeCircle(x, M + 4, i === this.nodeIndex ? 4.5 : 3)
    }
  }

  private drawBoss() {
    const g = this.bossGraphics.clear()
    this.bossText.setText(this.bossFill >= 0 ? (this.bossName ?? '') : '')
    if (this.bossFill < 0) return
    const w = Math.min(220, this.view.width * 0.45)
    const x = this.view.width / 2 - w / 2
    g.fillStyle(PALETTE.navy, 0.9).fillRect(x, M + 24, w, 7)
    g.fillStyle(HP_COLOR, 1).fillRect(x + 1, M + 25, (w - 2) * (this.bossFill / 200), 5)
  }
}
