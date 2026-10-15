import Phaser from 'phaser'
import type { Combatant, CombatWorld, HitEvent, KillerInfo } from '../../contracts/combat'
import { DEPTH, PALETTE } from '../../contracts/constants'
import type { Action, Bindings, InputFrame } from '../../contracts/input'
import { bindingLabel } from '../../model/input'
import { cssColor } from '../color'
import { preloadCoreAssets } from '../assets'
import { createCombatWorld } from '../combat'
import { createInputLayer, type InputLayer } from '../input/InputLayer'
import type { Segment } from '../../contracts/run'
import { INSPECT_DIM_DEPTH, PAUSE_DIM_ALPHA } from '../mobs/tuning'
import { createInspector, inspectInfo, isDescription, mobXp, type InspectTarget, type Inspector } from '../mobs'
import { attachLoadout, type LoadoutWithStatus } from '../player/weapons'
import { createPlayer, type Player } from '../player/Player'
import { followView, viewForBox, type View } from '../view'
import { MOB_INFO_EVENT } from './mobInfoEvent'
import type { GameplayControl, RunContext, TraderLoot } from './context'
import { interactPressed } from './interaction'
import { addText } from './ui'
import { PIT_KILLER, type RunDirector } from './RunDirector'
import type { DatenkrakeDeal } from '../../model/progression'

// 'encounter' holds the world while a waystation encounter plays out on its own (the Datenkrake's
// grab), 'datenkrake' while its overlay is open, 'loot' while the beaten FAIR trader's loot shows.
type Hold = 'banner' | 'levelUp' | 'store' | 'datenkrake' | 'encounter' | 'loot' | 'pause' | 'external' | 'over'

export interface LevelSetup {
  colliders: Phaser.Types.Physics.Arcade.ArcadeColliderType[]
  spawn: { x: number; y: number }
  bounds: { x: number; y: number; width: number; height: number }
}

const LOOK_AHEAD = 56
// A heavy player hit nudges the camera. Light hits do not.
const HEAVY_SHAKE_MS = 60
const HEAVY_SHAKE_INTENSITY = 0.0025

// What Stretch, Boss and FinalBoss share: the player, the loadout, the combat world, the camera,
// XP and death, the intro banner and every way the world can be held still.
export abstract class GameplayScene extends Phaser.Scene implements GameplayControl {
  protected readonly ctx: RunContext
  protected director!: RunDirector
  protected combat!: CombatWorld
  protected player!: Player
  protected loadout!: LoadoutWithStatus
  protected view: View = viewForBox(1, 1)
  private controls!: InputLayer
  private frame!: InputFrame
  private readonly holds = new Set<Hold>()
  private frozen = false
  private bannerMs = 0
  private lookAhead = 0
  private inspector: Inspector | null = null
  private pauseDim: Phaser.GameObjects.Rectangle | null = null
  // The interaction prompt ("[W] Enter", "[W] Trade"), one per scene, shown by showPrompt.
  private prompt: Phaser.GameObjects.Text | null = null
  private promptText: string | null = null
  private promptKeyed = false
  private promptBindings = -1

  constructor(key: string, ctx: RunContext) {
    super(key)
    this.ctx = ctx
  }

  // Builds the static world and returns where the player starts.
  protected abstract buildLevel(data: { index?: number }): LevelSetup
  // Runs after the player exists: enemies, banner.
  protected abstract setup(): void
  // Once per fixed step while the world runs and no hit-stop holds it.
  protected abstract stepWorld(dtMs: number): void
  protected onView(_view: View): void {}
  protected onFrame(_deltaMs: number): void {}
  protected onBannerFrame(): void {}
  protected onBannerDone(): void {}
  protected onShutdown(): void {}
  // After the FAIR trade store closed, whichever way the player left it.
  protected onStoreClosed(): void {}
  // After the Datenkrake overlay closed with a choice.
  protected onDatenkrakeClosed(): void {}
  // Freezes or thaws what else acts like the player (the fighting FAIR trader), with the player:
  // for every hold and every hit-stop.
  protected freezeActors(_frozen: boolean): void {}
  // The mobs and bosses the pause menu lets the player inspect, and the step the mobs come from.
  protected inspectableMobs(): InspectTarget[] {
    return []
  }
  protected inspectSegment(): Segment | null {
    return null
  }
  // XP for a kill by the player's side. Boss scenes credit the boss through its spec instead.
  protected xpFor(target: Combatant): number {
    return mobXp(target)
  }

  preload() {
    preloadCoreAssets(this)
  }

  create(data: { index?: number }) {
    const director = this.ctx.director
    if (!director) return
    this.director = director
    this.holds.clear()
    this.frozen = false
    this.bannerMs = 0
    this.lookAhead = 0
    // A restarted scene keeps its clock and tween manager, so clear what an earlier hold left.
    this.time.paused = false
    this.tweens.resumeAll()

    followView(this, (view) => {
      this.view = view
      this.onView(view)
    })
    const art = this.ctx.art
    this.combat = createCombatWorld(this, { art })
    this.controls = createInputLayer(this, this.ctx.bindings)
    this.frame = this.controls.frame()
    // Registered before the player's own listener, so the scene reads the input first and can
    // swallow it while the world is held.
    this.physics.world.on('worldstep', this.onStep, this)

    const level = this.buildLevel(data)
    const frameSource: InputLayer = {
      frame: () => this.frame,
      setBindings: () => {},
      setEnabled: () => {},
      destroy: () => {},
    }
    this.player = createPlayer(
      this,
      { combat: this.combat, art, input: frameSource, build: director.build, colliders: level.colliders },
      level.spawn.x,
      level.spawn.y,
    )
    this.loadout = attachLoadout({
      scene: this,
      combat: this.combat,
      art,
      player: this.player,
      rng: director.rng.fork(`loadout/${this.scene.key}/${data.index ?? 0}`),
      // Sleeping mobs leave the combat world, so the living enemy team is the awake mobs plus whatever they or a boss summon.
      enemies: () => this.combat.livingCombatants('enemy'),
      secondWind: director.secondWind,
    })
    this.loadout.sync(director.build)
    this.combat.on('kill', (event) => this.onKill(event))
    // Data Leak: a hit spills fragments.
    this.player.on('damaged', () => this.director.leakFragments())
    this.combat.on('hit', (event) => this.onHit(event))
    this.inspector = createInspector(this, (mob) => this.pickMob(mob))
    // Drawn here, not in the HUD, so the mob under the pointer can sit above it at full brightness.
    this.pauseDim = this.add.rectangle(0, 0, 1, 1, PALETTE.navy, PAUSE_DIM_ALPHA).setDepth(INSPECT_DIM_DEPTH).setVisible(false)
    this.prompt = addText(this, '', 7, { color: PALETTE.navy, bold: true, align: 'center' })
      .setOrigin(0.5, 1)
      .setBackgroundColor(cssColor(PALETTE.yellow))
      .setPadding(3, 1, 3, 1)
      .setDepth(DEPTH.fx)
      .setVisible(false)
    this.promptText = null
    this.promptBindings = -1

    const camera = this.cameras.main
    const { x, y, width, height } = level.bounds
    camera.setBounds(x, y, width, height)
    camera.startFollow(this.player.gameObject, false, 0.14, 0.14)
    camera.setDeadzone(24, 40)

    this.ctx.gameplay = this
    this.ctx.active = { player: this.player, loadout: this.loadout, boss: null, bossName: '' }
    this.events.once('shutdown', this.shutdown, this)
    if (this.ctx.externalPause) this.setHold('external', true)
    this.setup()
  }

  update(time: number, delta: number) {
    if (!this.director || !this.player) return
    if (this.holds.has('pause')) {
      this.inspector?.update(time)
      this.fitPauseDim()
    }
    // The world does not step while held, so the scene reads the pause key here instead.
    if (this.physics.world.isPaused) this.readInput()
    if (this.holds.has('banner') && this.holds.size === 1) {
      this.onBannerFrame()
      this.bannerMs -= delta
      if (this.bannerMs <= 0) {
        this.setHold('banner', false)
        this.onBannerDone()
      }
    }
    const ease = 1 - Math.exp((-Math.min(delta, 50) / 1000) * 3)
    this.lookAhead += (this.player.facing() * LOOK_AHEAD - this.lookAhead) * ease
    this.cameras.main.setFollowOffset(-this.lookAhead, 36)
    this.onFrame(delta)
  }

  private onStep(deltaSeconds: number) {
    this.readInput()
    if (this.frozen) return
    const dt = deltaSeconds * 1000
    this.combat.update(dt)
    const stopped = this.combat.hitStopRemainingMs() > 0
    // A kill in this step may have opened the level-up and held the world.
    this.player.setFrozen(stopped || this.frozen)
    this.freezeActors(stopped || this.frozen)
    if (!stopped && !this.frozen) {
      this.loadout.update(dt)
      this.stepWorld(dt)
    }
    this.director.tick(dt)
  }

  private readInput() {
    this.frame = this.controls.frame()
    const pressed = this.frame.pressed
    // The pause key leaves the store, and so does walking away. The press is used up here, so it
    // does not open the pause menu on the next frame.
    if (this.holds.has('store')) {
      if (pressed.has('pause') || pressed.has('left') || pressed.has('right')) this.closeStore()
      return
    }
    // In the Datenkrake's grip there is nothing to do but choose, and the loot is read to the end.
    if (this.holds.has('datenkrake') || this.holds.has('encounter') || this.holds.has('loot')) return
    if (pressed.has('pause')) this.togglePause()
  }

  // The direction left or right holds, 0 for neither or both. Valid inside stepWorld.
  protected heldDirection(): -1 | 0 | 1 {
    const held = this.frame.held
    return held.has('left') === held.has('right') ? 0 : held.has('right') ? 1 : -1
  }

  // Went down since the previous step. Valid inside stepWorld.
  protected pressed(action: Action): boolean {
    return this.frame.pressed.has(action)
  }

  // An up press that interacts (a portal, the trader), not one that starts an up attack. Valid
  // inside stepWorld.
  protected interactPressed(): boolean {
    return interactPressed(this.frame.pressed)
  }

  // Shows the interaction prompt with its bottom centre at (x, y), null hides it. With `keyed` the
  // key of up comes first, "[W] Enter", and follows a binding change. Cheap to call every step:
  // the text is only set again when it changes.
  protected showPrompt(text: string | null, x = 0, y = 0, keyed = true) {
    const prompt = this.prompt
    if (!prompt) return
    if (text === null) {
      if (this.promptText !== null) prompt.setVisible(false)
      this.promptText = null
      return
    }
    if (text !== this.promptText || keyed !== this.promptKeyed || this.promptBindings !== this.ctx.bindingsVersion) {
      this.promptText = text
      this.promptKeyed = keyed
      this.promptBindings = this.ctx.bindingsVersion
      const binding = this.ctx.bindings.up[0]
      prompt.setText(keyed && binding ? `[${bindingLabel(binding)}] ${text}` : text)
    }
    if (prompt.x !== x || prompt.y !== y) prompt.setPosition(x, y)
    prompt.setVisible(true)
  }

  private togglePause() {
    if (this.holds.has('levelUp') || this.holds.has('store') || this.holds.has('datenkrake') || this.holds.has('encounter') || this.holds.has('loot')) return
    if (this.holds.has('over') || this.holds.has('external')) return
    const paused = !this.holds.has('pause')
    this.setHold('pause', paused)
    this.inspector?.setActive(paused, paused ? this.inspectableMobs() : [])
    this.pauseDim?.setVisible(paused)
    if (paused) this.fitPauseDim()
    this.ctx.hud?.showPause(paused)
    this.ctx.emit({ type: 'paused', paused })
  }

  protected setHold(reason: Hold, on: boolean) {
    if (on) this.holds.add(reason)
    else this.holds.delete(reason)
    const frozen = this.holds.size > 0
    if (frozen === this.frozen) return
    this.frozen = frozen
    this.player?.setFrozen(frozen)
    this.freezeActors(frozen)
    if (frozen) {
      this.physics.world.pause()
      this.time.paused = true
      this.tweens.pauseAll()
    } else {
      this.physics.world.resume()
      this.time.paused = false
      this.tweens.resumeAll()
    }
  }

  protected isHeld(): boolean {
    return this.frozen
  }

  // Holds the world for `ms` while the HUD shows the banner.
  protected showIntro(title: string, subtitle: string, ms: number) {
    this.bannerMs = ms
    this.setHold('banner', true)
    this.ctx.hud?.showBanner(title, subtitle, ms)
  }

  protected gainXp(amount: number) {
    if (amount <= 0) return
    this.director.setHp(this.player.hp())
    if (this.director.creditXp(amount) > 0) this.player.setBuild(this.director.build)
    if (this.director.pendingLevelUps > 0 && !this.holds.has('levelUp')) {
      this.setHold('levelUp', true)
      this.ctx.openLevelUp()
    }
  }

  protected gainFragments(amount: number) {
    this.director.addFragments(amount)
  }

  // Holds the world while the store overlay of node boss `index` is open, like the level-up screen.
  protected openStore(index: number) {
    if (this.holds.size > 0) return
    this.setHold('store', true)
    this.ctx.openStore(index)
  }

  // Holds the world while an encounter plays an animation of its own.
  protected holdForEncounter(on: boolean) {
    this.setHold('encounter', on)
  }

  // Opens the Datenkrake overlay of the waystation after node boss `index`. It may open while the
  // encounter hold of the grab is still on.
  protected openDatenkrake(index: number) {
    if (this.holds.has('over') || this.holds.has('datenkrake')) return
    this.setHold('datenkrake', true)
    this.ctx.openDatenkrake(index)
  }

  // Holds the world and shows what the beaten FAIR trader left. The cards are applied already.
  protected openTraderLoot(loot: TraderLoot) {
    if (this.holds.has('over') || this.holds.has('loot')) return
    this.setHold('loot', true)
    this.ctx.openTraderLoot(loot)
  }

  protected die(killer: KillerInfo) {
    if (this.holds.has('over')) return
    this.setHold('over', true)
    this.director.setHp(0)
    this.director.die(killer)
  }

  // Ends the scene through the director. Hp carries over to the next scene.
  protected leave(next: (director: RunDirector) => void) {
    if (this.holds.has('over')) return
    this.setHold('over', true)
    this.director.setHp(this.player.hp())
    next(this.director)
  }

  private onHit(event: HitEvent) {
    if (event.attacker === this.player && event.tags.includes('heavy')) this.cameras.main.shake(HEAVY_SHAKE_MS, HEAVY_SHAKE_INTENSITY)
  }

  // Covers the camera view. The camera can still drift a little while the world is held.
  private fitPauseDim() {
    const view = this.cameras.main.worldView
    this.pauseDim?.setPosition(view.centerX, view.centerY).setSize(view.width + 8, view.height + 8)
  }

  // Vertical place of the mob in the camera view, 0 at the top to 1 at the bottom.
  private focusOf(mob: InspectTarget): number {
    const view = this.cameras.main.worldView
    return (mob.hurtbox().centerY - view.y) / view.height
  }

  private pickMob(mob: InspectTarget | null) {
    this.inspector?.select(mob)
    const info = mob ? inspectInfo(mob) : null
    const segment = this.inspectSegment()
    if (mob && info && (isDescription(info) || segment)) this.game.events.emit(MOB_INFO_EVENT, info, segment, this.focusOf(mob))
    else this.game.events.emit(MOB_INFO_EVENT)
  }

  private onKill(event: HitEvent) {
    if (event.target === this.player) {
      this.die(event.attacker.killer ?? PIT_KILLER)
      return
    }
    if (event.attacker.team !== 'player') return
    // Accept All Cookies: every kill raises max HP for good.
    this.director.setHp(this.player.hp())
    if (this.director.eatCookie()) this.player.setBuild(this.director.build)
    this.gainXp(this.xpFor(event.target))
  }

  // Shots a beaten boss fired earlier must not kill the player during the outro. An unregistered
  // player cannot be hit at all, and the scene ends before the player would need the combat world again.
  protected spareAfterBoss(boss: Combatant) {
    this.combat.cancelOwnedBy(boss)
    this.combat.unregister(this.player)
  }

  // Pit damage. True when it was lethal.
  protected hurtByHazard(fraction: number, killer: KillerInfo): boolean {
    const build = this.player.getBuild()
    const hp = this.player.hp() - Math.ceil(build.stats.maxHp * fraction)
    if (hp <= 0) {
      this.player.setBuild({ ...build, hp: 0 })
      this.die(killer)
      return true
    }
    this.player.setBuild({ ...build, hp })
    return false
  }

  setExternalPause(paused: boolean) {
    this.setHold('external', paused)
  }

  resumeFromPause() {
    if (!this.holds.has('pause')) return
    this.setHold('pause', false)
    this.inspector?.setActive(false, [])
    this.pauseDim?.setVisible(false)
    this.ctx.hud?.showPause(false)
    this.ctx.emit({ type: 'paused', paused: false })
  }

  chooseCard(cardId: string | null) {
    this.director.setHp(this.player.hp())
    this.director.chooseCard(cardId)
    this.player.setBuild(this.director.build)
    this.loadout.sync(this.director.build)
    if (this.director.pendingLevelUps === 0) {
      this.ctx.closeLevelUp()
      this.setHold('levelUp', false)
      this.loadout.readEula()
    }
  }

  closeStore() {
    if (!this.holds.has('store')) return
    this.ctx.closeStore()
    this.setHold('store', false)
    this.onStoreClosed()
  }

  // "Submit": the Datenkrake swaps an augment for a corrupted one. The overlay shows the deal.
  submitToDatenkrake(index: number): DatenkrakeDeal | null {
    this.director.setHp(this.player.hp())
    const deal = this.director.submitToDatenkrake(index)
    if (!deal) return null
    this.player.setBuild(this.director.build)
    this.loadout.sync(this.director.build)
    return deal
  }

  fightDatenkrake(index: number) {
    this.director.fightDatenkrake(index)
  }

  closeDatenkrake() {
    if (!this.holds.has('datenkrake')) return
    this.ctx.closeDatenkrake()
    this.setHold('datenkrake', false)
    this.onDatenkrakeClosed()
  }

  closeTraderLoot() {
    if (!this.holds.has('loot')) return
    this.ctx.closeTraderLoot()
    this.setHold('loot', false)
  }

  // Only the card applies, like a level-up card without the level: hp, level and XP stay.
  buyCard(index: number, cardId: string): boolean {
    this.director.setHp(this.player.hp())
    if (!this.director.buy(index, cardId)) return false
    this.player.setBuild(this.director.build)
    this.loadout.sync(this.director.build)
    return true
  }

  setBindings(bindings: Bindings) {
    this.controls.setBindings(bindings)
  }

  private shutdown() {
    this.onShutdown()
    this.inspector?.destroy()
    this.inspector = null
    this.pauseDim = null
    this.prompt = null
    this.promptText = null
    this.loadout.destroy()
    this.controls.destroy()
    this.ctx.hud?.showPause(false)
    if (this.ctx.gameplay === this) {
      this.ctx.gameplay = null
      this.ctx.active = null
    }
  }
}
