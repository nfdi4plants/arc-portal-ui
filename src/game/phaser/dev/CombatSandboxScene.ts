import Phaser from 'phaser'
import type { Combatant, CombatWorld, HitEvent, Team } from '../../contracts/combat'
import { DEPTH, PALETTE, SCENE, STEP_MS } from '../../contracts/constants'
import { createRng } from '../../contracts/rng'
import { createCombatWorld } from '../combat'
import { followView } from '../view'

const GROUND_Y = 250
const DUMMY_WIDTH = 24
const DUMMY_HEIGHT = 44
const ENEMY_COLOR = 0xe5484d
const SWING_EVERY_MS = 1000
const SHOT_EVERY_MS = 1500
const PULSE_EVERY_MS = 2000
const PULSE_ACTIVE_MS = 900

interface DummyOptions {
  id: string
  name: string
  team: Team
  x: number
  facing: 1 | -1
  color: number
  maxHp: number
}

// A rectangle that takes hits, gets shoved, springs back and stands up again after a knockout.
// position() is the bottom centre, like the origin of a SpriteRef.
class Dummy implements Combatant {
  readonly id: string
  readonly team: Team
  readonly killer = null
  private readonly name: string
  private readonly homeX: number
  private readonly face: 1 | -1
  private readonly color: number
  private readonly maxHp: number
  private readonly box = new Phaser.Geom.Rectangle()
  private readonly body: Phaser.GameObjects.Rectangle
  private readonly label: Phaser.GameObjects.Text
  private hp: number
  private offsetX = 0
  private offsetY = 0
  private velX = 0
  private velY = 0
  private flashMs = 0
  private downMs = 0

  constructor(scene: Phaser.Scene, options: DummyOptions) {
    this.id = options.id
    this.team = options.team
    this.name = options.name
    this.homeX = options.x
    this.face = options.facing
    this.color = options.color
    this.maxHp = options.maxHp
    this.hp = options.maxHp
    this.body = scene.add
      .rectangle(options.x, GROUND_Y, DUMMY_WIDTH, DUMMY_HEIGHT, options.color)
      .setOrigin(0.5, 1)
      .setStrokeStyle(1, PALETTE.outline)
      .setDepth(options.team === 'player' ? DEPTH.player : DEPTH.enemies)
    this.label = createLabel(scene, options.x, GROUND_Y - DUMMY_HEIGHT - 6, 8).setOrigin(0.5, 1).setDepth(DEPTH.hud)
    this.sync()
  }

  hurtbox() {
    return this.box.setTo(this.homeX + this.offsetX - DUMMY_WIDTH / 2, GROUND_Y + this.offsetY - DUMMY_HEIGHT, DUMMY_WIDTH, DUMMY_HEIGHT)
  }

  facing() {
    return this.face
  }

  position() {
    return { x: this.homeX + this.offsetX, y: GROUND_Y + this.offsetY }
  }

  isInvulnerable() {
    return false
  }

  isDead() {
    return this.hp <= 0
  }

  receiveHit(hit: HitEvent) {
    this.hp = Math.max(0, this.hp - hit.damage)
    this.velX = hit.knockback.x
    this.velY = hit.knockback.y
    this.flashMs = 90
    if (this.hp === 0) this.downMs = 1200
    this.sync()
  }

  step(deltaMs: number) {
    const seconds = deltaMs / 1000
    if (this.isDead()) {
      this.downMs -= deltaMs
      if (this.downMs <= 0) this.hp = this.maxHp
    }
    this.flashMs = Math.max(0, this.flashMs - deltaMs)
    this.velX -= this.velX * Math.min(1, 10 * seconds)
    this.offsetX += this.velX * seconds
    this.offsetX -= this.offsetX * Math.min(1, 6 * seconds)
    this.offsetY += this.velY * seconds
    this.velY += 900 * seconds
    if (this.offsetY > 0) {
      this.offsetY = 0
      this.velY = 0
    }
    this.sync()
  }

  private sync() {
    const x = this.homeX + this.offsetX
    this.body.setPosition(x, GROUND_Y + this.offsetY)
    this.body.setFillStyle(this.flashMs > 0 ? PALETTE.cream : this.color)
    this.body.setAlpha(this.isDead() ? 0.3 : 1)
    this.label.setPosition(x, GROUND_Y + this.offsetY - DUMMY_HEIGHT - 6)
    const text = `${this.name}\n${this.isDead() ? 'KO' : `HP ${Math.ceil(this.hp)}/${this.maxHp}`}`
    if (this.label.text !== text) this.label.setText(text)
  }
}

function createLabel(scene: Phaser.Scene, x: number, y: number, size: number) {
  const text = scene.add.text(x, y, '', { fontFamily: 'sans-serif', fontSize: `${size}px`, color: '#253447', align: 'center' })
  // The camera zooms the text up, so it is rasterised at least at that scale.
  return text.setResolution(Math.max(2, Math.ceil(scene.cameras.main.zoom)))
}

// Shows the combat core without a player: an attacker swings and shoots at a target dummy, and a
// third dummy pulses a reflect hitbox that sends some of the shots back.
export class CombatSandboxScene extends Phaser.Scene {
  private combat!: CombatWorld
  private dummies: Dummy[] = []
  private attacker!: Dummy
  private reflector!: Dummy
  private shield!: Phaser.GameObjects.Rectangle
  private status!: Phaser.GameObjects.Text
  private accumulatorMs = 0
  private swingInMs = 0
  private shotInMs = 0
  private pulseInMs = 0
  private shieldMs = 0
  private hits = 0
  private crits = 0
  private kills = 0

  constructor() {
    super(SCENE.combatSandbox)
  }

  create() {
    this.accumulatorMs = 0
    this.swingInMs = 600
    this.shotInMs = 900
    this.pulseInMs = 500
    this.shieldMs = 0
    this.hits = 0
    this.crits = 0
    this.kills = 0

    followView(this, () => this.cameras.main.centerOn(240, 180))
    this.add.rectangle(240, GROUND_Y, 960, 2, PALETTE.navy).setOrigin(0.5, 0).setDepth(DEPTH.tiles)

    this.attacker = new Dummy(this, { id: 'attacker', name: 'attacker', team: 'player', x: 70, facing: 1, color: PALETTE.blue, maxHp: 100 })
    const target = new Dummy(this, { id: 'target', name: 'target', team: 'enemy', x: 126, facing: -1, color: ENEMY_COLOR, maxHp: 100 })
    this.reflector = new Dummy(this, { id: 'reflector', name: 'reflector', team: 'enemy', x: 420, facing: -1, color: PALETTE.navy, maxHp: 100 })
    this.dummies = [this.attacker, target, this.reflector]

    // Covers the world area of the reflect hitbox, which sits in front of the left-facing dummy.
    this.shield = this.add.rectangle(380, GROUND_Y - 52, 28, 56, PALETTE.teal, 0.35).setOrigin(0, 0).setDepth(DEPTH.fx).setVisible(false)

    this.combat = createCombatWorld(this, { debug: true })
    for (const dummy of this.dummies) this.combat.register(dummy)

    const rng = createRng('combat-sandbox')
    this.combat.addDamageModifier((_attacker, base) => {
      const crit = rng.chance(0.25)
      return { damage: crit ? base * 2 : base, crit }
    })
    this.combat.on('hit', (event) => {
      this.hits++
      if (event.crit) this.crits++
      this.updateStatus()
    })
    this.combat.on('kill', () => {
      this.kills++
      this.updateStatus()
    })

    createLabel(this, 240, 30, 9).setOrigin(0.5, 0).setDepth(DEPTH.hud).setText(
      'Attacker swings every 1.0 s and shoots every 1.5 s.\nThe right dummy raises a reflect hitbox every 2.0 s.\nOutlines: teal hurtboxes, red hitboxes, yellow projectiles, blue reflect.',
    )
    this.status = createLabel(this, 240, 300, 9).setOrigin(0.5, 0).setDepth(DEPTH.hud)
    this.updateStatus()
  }

  update(_time: number, deltaMs: number) {
    this.accumulatorMs += Math.min(deltaMs, 250)
    while (this.accumulatorMs >= STEP_MS) {
      this.accumulatorMs -= STEP_MS
      this.step(STEP_MS)
    }
  }

  private step(deltaMs: number) {
    // Actors stand still during hit-stop, exactly as a real scene would freeze them.
    const frozen = this.combat.hitStopRemainingMs() > 0
    this.combat.update(deltaMs)
    if (frozen) return

    for (const dummy of this.dummies) dummy.step(deltaMs)

    this.swingInMs -= deltaMs
    if (this.swingInMs <= 0) {
      this.swingInMs += SWING_EVERY_MS
      this.swing()
    }
    this.shotInMs -= deltaMs
    if (this.shotInMs <= 0) {
      this.shotInMs += SHOT_EVERY_MS
      this.shoot()
    }
    this.pulseInMs -= deltaMs
    if (this.pulseInMs <= 0) {
      this.pulseInMs += PULSE_EVERY_MS
      this.pulse()
    }
    this.shieldMs = Math.max(0, this.shieldMs - deltaMs)
    this.shield.setVisible(this.shieldMs > 0)
  }

  private swing() {
    if (this.attacker.isDead()) return
    this.combat.spawnHitbox({
      owner: this.attacker,
      shape: { kind: 'rect', x: 8, y: -40, w: 52, h: 34 },
      follow: true,
      activeMs: 120,
      damage: 12,
      knockback: { x: 150, y: -70 },
      hitStopMs: 70,
      maxTargets: Infinity,
      tags: ['light'],
    })
  }

  private shoot() {
    if (this.attacker.isDead()) return
    const { x, y } = this.attacker.position()
    this.combat.spawnProjectile(
      {
        owner: this.attacker,
        shape: { kind: 'circle', x: 0, y: 0, r: 5 },
        damage: 8,
        knockback: { x: 60, y: -30 },
        hitStopMs: 40,
        maxTargets: Infinity,
        tags: ['projectile'],
        // Not a real texture key, so the world falls back to the orb art.
        textureKey: 'orb',
        velocity: { x: 230, y: 0 },
        gravity: 0,
        lifetimeMs: 4500,
        pierce: 1,
        reflectable: true,
      },
      { x: x + 14, y: y - 26 },
    )
  }

  private pulse() {
    this.shieldMs = PULSE_ACTIVE_MS
    // maxTargets 0 makes this a reflect zone that never damages anyone.
    this.combat.spawnHitbox({
      owner: this.reflector,
      shape: { kind: 'rect', x: 12, y: -52, w: 28, h: 56 },
      follow: true,
      activeMs: PULSE_ACTIVE_MS,
      damage: 0,
      knockback: { x: 0, y: 0 },
      hitStopMs: 0,
      maxTargets: 0,
      tags: ['reflect'],
    })
  }

  private updateStatus() {
    this.status.setText(`hits ${this.hits}   crits ${this.crits}   knockouts ${this.kills}`)
  }
}
