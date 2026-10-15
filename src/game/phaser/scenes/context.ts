import type Phaser from 'phaser'
import { SCENE } from '../../contracts/constants'
import type { GameEvent } from '../../contracts/events'
import type { Bindings } from '../../contracts/input'
import type { PlayerHandle } from '../../contracts/player'
import type { RunPlan } from '../../contracts/run'
import type { StaggerState } from '../bosses'
import type { LoadoutWithStatus } from '../player/weapons'
import type { PowerUpCard } from '../../contracts/progression'
import type { DatenkrakeDeal } from '../../model/progression'
import { getArt } from './art'
import { RunDirector, type RunStage } from './RunDirector'

// The boss bar of the HUD: a node boss, the final boss or the fighting FAIR trader. A null stagger
// state shows no stagger bar.
export interface HudBoss {
  hpFraction(): number
  showHpBar(): boolean
  currentAttackName(): string | null
  staggerFraction(): number
  staggerState(): StaggerState | null
}

// What the HUD reads from the running gameplay scene.
export interface ActiveFight {
  player: PlayerHandle
  loadout: LoadoutWithStatus
  boss: HudBoss | null
  bossName: string
}

// What the beaten FAIR trader left, for the loot overlay.
export interface TraderLoot {
  cards: PowerUpCard[]
  bonus: PowerUpCard | null
  line: string
}

// What the overlay scenes may ask of the running gameplay scene.
export interface GameplayControl {
  setExternalPause(paused: boolean): void
  resumeFromPause(): void
  // Null skips a level whose offer was empty.
  chooseCard(cardId: string | null): void
  // The FAIR trade store in the waystation after node boss `index`. buyCard is false when the
  // purchase did not happen.
  buyCard(index: number, cardId: string): boolean
  closeStore(): void
  // The Datenkrake in the waystation after node boss `index`. submitToDatenkrake is null when the
  // deal cannot happen.
  submitToDatenkrake(index: number): DatenkrakeDeal | null
  fightDatenkrake(index: number): void
  closeDatenkrake(): void
  // The loot overlay of the beaten FAIR trader was read.
  closeTraderLoot(): void
  setBindings(bindings: Bindings): void
}

export interface HudControl {
  showBanner(title: string, subtitle: string, ms: number): void
  showPause(visible: boolean): void
}

const GAMEPLAY_SCENES = [SCENE.stretch, SCENE.boss, SCENE.waystation, SCENE.finalBoss]
const GAMEPLAY_SCENE_OF = { stretch: SCENE.stretch, boss: SCENE.boss, waystation: SCENE.waystation, finalBoss: SCENE.finalBoss } as const
const RUN_SCENES = [...GAMEPLAY_SCENES, SCENE.hud, SCENE.levelUp, SCENE.store, SCENE.datenkrake, SCENE.traderLoot, SCENE.death, SCENE.victory]
// Overlays that end with the stage they opened in.
const STAGE_OVERLAYS = [SCENE.levelUp, SCENE.store, SCENE.datenkrake, SCENE.traderLoot]

// Shared by every scene of one game. It holds the run and switches the scenes when the run
// moves on to the next stage.
export class RunContext {
  readonly art = getArt()
  bindings: Bindings
  // Counts binding changes, so the HUD relabels its slots only after one.
  bindingsVersion = 0
  director: RunDirector | null = null
  active: ActiveFight | null = null
  gameplay: GameplayControl | null = null
  hud: HudControl | null = null
  externalPause = false
  private game: Phaser.Game | null = null
  private readonly emitEvent: (event: GameEvent) => void

  constructor(bindings: Bindings, emit: (event: GameEvent) => void) {
    this.bindings = bindings
    this.emitEvent = emit
  }

  attach(game: Phaser.Game): void {
    this.game = game
  }

  emit(event: GameEvent): void {
    this.emitEvent(event)
  }

  startRun(plan: RunPlan): void {
    if (!this.game) return
    this.stopRun()
    this.director = new RunDirector(plan, { emit: (event) => this.emit(event), enter: (stage) => this.enter(stage) })
    this.sceneOp('start', SCENE.hud)
    this.director.start()
  }

  stopRun(): void {
    const scenes = this.game?.scene
    if (!scenes) return
    for (const key of RUN_SCENES) if (isRunning(scenes, key)) this.sceneOp('stop', key)
    this.director = null
    this.active = null
  }

  quitToMenu(): void {
    this.stopRun()
    this.emit({ type: 'menuRequested', choice: 'menu' })
  }

  requestMenu(choice: 'retry' | 'newPath' | 'menu'): void {
    this.emit({ type: 'menuRequested', choice })
  }

  setBindings(bindings: Bindings): void {
    this.bindings = bindings
    this.bindingsVersion++
    this.gameplay?.setBindings(bindings)
  }

  setExternalPause(paused: boolean): void {
    this.externalPause = paused
    this.gameplay?.setExternalPause(paused)
    this.emit({ type: 'paused', paused })
  }

  openLevelUp(): void {
    this.sceneOp('run', SCENE.levelUp)
  }

  closeLevelUp(): void {
    this.sceneOp('stop', SCENE.levelUp)
  }

  openStore(index: number): void {
    this.sceneOp('start', SCENE.store, { index })
  }

  closeStore(): void {
    this.sceneOp('stop', SCENE.store)
  }

  openDatenkrake(index: number): void {
    this.sceneOp('start', SCENE.datenkrake, { index })
  }

  closeDatenkrake(): void {
    this.sceneOp('stop', SCENE.datenkrake)
  }

  openTraderLoot(loot: TraderLoot): void {
    this.sceneOp('start', SCENE.traderLoot, loot)
  }

  closeTraderLoot(): void {
    this.sceneOp('stop', SCENE.traderLoot)
  }

  private enter(stage: RunStage): void {
    const scenes = this.game?.scene
    if (!scenes) return
    switch (stage.kind) {
      case 'stretch':
      case 'boss':
      case 'waystation':
      case 'finalBoss': {
        this.stopGameplay(scenes)
        for (const key of STAGE_OVERLAYS) this.sceneOp('stop', key)
        this.sceneOp('start', GAMEPLAY_SCENE_OF[stage.kind], stage.kind === 'finalBoss' ? {} : { index: stage.index })
        break
      }
      case 'victory':
        this.stopGameplay(scenes)
        this.sceneOp('stop', SCENE.hud)
        for (const key of STAGE_OVERLAYS) this.sceneOp('stop', key)
        this.sceneOp('start', SCENE.victory)
        break
      case 'dead':
        // The frozen world stays visible behind the death screen.
        for (const key of GAMEPLAY_SCENES) if (scenes.isActive(key)) this.sceneOp('pause', key)
        this.sceneOp('stop', SCENE.hud)
        for (const key of STAGE_OVERLAYS) this.sceneOp('stop', key)
        this.sceneOp('start', SCENE.death, { killer: stage.killer })
        break
    }
  }

  private stopGameplay(scenes: Phaser.Scenes.SceneManager): void {
    for (const key of GAMEPLAY_SCENES) if (isRunning(scenes, key)) this.sceneOp('stop', key)
  }

  // The scene manager stops and pauses scenes at once, even from inside a running scene's step,
  // which would pull the physics world out from under it. Inside a step the change waits for the
  // start of the next one.
  private sceneOp(op: 'start' | 'stop' | 'pause' | 'run', key: string, data?: object): void {
    const scenes = this.game?.scene
    if (!scenes) return
    if (scenes.isProcessing) (scenes as QueueingSceneManager).queueOp(op, key, data)
    else scenes[op](key, data)
  }
}

// Phaser has queueOp but leaves it out of its type definitions.
type QueueingSceneManager = Phaser.Scenes.SceneManager & { queueOp(op: string, keyA: string, keyB?: object): void }

function isRunning(scenes: Phaser.Scenes.SceneManager, key: string): boolean {
  return scenes.isActive(key) || scenes.isPaused(key) || scenes.isSleeping(key)
}
