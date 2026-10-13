import Phaser from 'phaser'
import type { AnnotationCategory, IoKind } from '../../../arc/provenance/types'
import type { FxArt, ProjectileArt, SpriteRef, TelegraphArt, Theme } from '../../contracts/art'
import type { BodyKind, BossArchetype, BossSpec, EnemyWeaponKind, FinalBossSpec, MonsterSpec, PassiveKind } from '../../contracts/content'
import { SCENE } from '../../contracts/constants'
import type { PlayerWeaponId } from '../../contracts/progression'
import { applySpriteRef, createScribbleArt, prewarm, TEXTURE_SCALE, textureBytes } from '../art'
import type { PartRef } from '../art/parts'
import { followView, viewForBox } from '../view'
import type { View } from '../view'

// Every generated sprite on one scrollable page. Wheel or arrow keys scroll, shift+wheel scrolls
// sideways. The monster specs are built by hand here so the scene does not depend on the content
// generators.

const BODIES: BodyKind[] = ['slime', 'wisp', 'beetle', 'golem', 'imp', 'turret', 'bat', 'crawler']
const WEAPONS: EnemyWeaponKind[] = ['claw', 'spear', 'bow', 'wand', 'bomb', 'shield', 'whip', 'flask']
const PASSIVES: PassiveKind[] = ['armored', 'stanceShift', 'tuned', 'shieldDrop', 'patrol', 'summoner', 'blink', 'chatter']
const SIZES = ['small', 'medium', 'large'] as const
const ARCHETYPES: BossArchetype[] = ['rootTreant', 'specimenJar', 'reagentGolem', 'glitchDaemon']
const NODE_KIND: Record<BossArchetype, IoKind> = { rootTreant: 'source', specimenJar: 'sample', reagentGolem: 'material', glitchDaemon: 'data' }
const PLAYER_WEAPONS: PlayerWeaponId[] = ['staff', 'wand', 'pipettePistol', 'centrifugeDisc', 'scalpel', 'sequenceWhip', 'beakerHammer', 'bunsenStaff', 'petriShield']
const PROJECTILES: ProjectileArt[] = ['bolt', 'droplet', 'disc', 'arrow', 'bomb', 'flame', 'orb']
const TELEGRAPHS: { shape: TelegraphArt; w: number; h: number }[] = [
  { shape: 'rect', w: 80, h: 40 },
  { shape: 'circle', w: 56, h: 56 },
  { shape: 'cone', w: 90, h: 50 },
  { shape: 'line', w: 120, h: 10 },
]
const FX: FxArt[] = ['hit', 'crit', 'dust', 'levelUp', 'death', 'xp']
const THEMES: Theme[] = ['study', 'assay', 'run']

const CATEGORY: Record<PassiveKind, AnnotationCategory> = {
  armored: 'characteristic',
  stanceShift: 'factor',
  tuned: 'parameter',
  shieldDrop: 'component',
  patrol: 'protocol',
  summoner: 'performer',
  blink: 'date',
  chatter: 'comment',
}

function monsterSpec(
  id: string,
  body: BodyKind,
  weapon: EnemyWeaponKind,
  passive: PassiveKind,
  size: MonsterSpec['size'],
  hue: number,
  variant: number,
  scale = 1,
): MonsterSpec {
  return {
    id,
    source: { name: id, value: null, unit: null, accession: null, category: CATEGORY[passive] },
    label: id,
    body,
    hue,
    size,
    weapon: { kind: weapon, scale, calibrated: false, damage: 1, cooldownMs: 1000, range: 100 },
    passive: { kind: passive, variant },
    stats: { hp: 10, contactDamage: 1, speed: 40, aggroRange: 120 },
    xp: 10,
    segmentIndex: 0,
  }
}

function bossSpec(archetype: BossArchetype): BossSpec {
  return {
    nodeId: `gallery:${archetype}`,
    nodeKind: NODE_KIND[archetype],
    archetype,
    label: archetype,
    segmentIndex: 0,
    quality: 1,
    telegraphMs: 900,
    showHpBar: true,
    showAttackNames: true,
    safeZones: 3,
    weakPoints: 3,
    staggerWindowMs: 1600,
    tells: [],
    hp: 400,
    attacks: [],
    xp: 15,
  }
}

const FINAL_BOSS: FinalBossSpec = { title: 'Talinum growth under drought stress', hp: 2400, phases: [] }

const CELL = { w: 120, h: 70 }
const LEFT = 56
const STYLE = { fontFamily: 'Consolas, "Courier New", monospace', color: '#5b5346', resolution: 4 }

export class ArtGalleryScene extends Phaser.Scene {
  private readonly art = createScribbleArt()
  private view: View = viewForBox(1, 1)
  private scroll = { x: 0, y: 0 }
  private content = { width: 1100, height: 0 }
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null
  private parallax: { sprite: Phaser.GameObjects.TileSprite; speed: number }[] = []
  private memory: Phaser.GameObjects.Text | null = null

  constructor() {
    super(SCENE.artGallery)
  }

  create(): void {
    followView(this, (view) => {
      this.view = view
      this.applyScroll()
    })
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) => {
      const sideways = (pointer.event as WheelEvent).shiftKey
      this.scroll.x += dx + (sideways ? dy : 0)
      this.scroll.y += sideways ? 0 : dy
      this.applyScroll()
    })
    this.cursors = this.input.keyboard?.createCursorKeys() ?? null

    let y = 8
    y = this.header(y)
    y = this.bodyWeaponGrid(y)
    y = this.passiveRows(y)
    y = this.faceRow(y)
    y = this.bossRow(y)
    y = this.finalBossRow(y)
    y = this.weaponRows(y)
    y = this.smallThings(y)
    y = this.themePanels(y)
    this.content.height = y + 20
    this.memory?.setText(this.memoryReport())
    this.applyScroll()
  }

  update(time: number, delta: number): void {
    const speed = 0.35 * delta
    const c = this.cursors
    if (c) {
      this.scroll.x += ((c.right.isDown ? 1 : 0) - (c.left.isDown ? 1 : 0)) * speed
      this.scroll.y += ((c.down.isDown ? 1 : 0) - (c.up.isDown ? 1 : 0)) * speed
      this.applyScroll()
    }
    for (const { sprite, speed: s } of this.parallax) sprite.tilePositionX = (time / 1000) * s
  }

  private applyScroll(): void {
    this.scroll.x = Phaser.Math.Clamp(this.scroll.x, 0, Math.max(0, this.content.width - this.view.width))
    this.scroll.y = Phaser.Math.Clamp(this.scroll.y, 0, Math.max(0, this.content.height - this.view.height))
    this.cameras.main.centerOn(this.scroll.x + this.view.width / 2, this.scroll.y + this.view.height / 2)
  }

  private text(x: number, y: number, value: string, size = 7, originX = 0.5): Phaser.GameObjects.Text {
    return this.add.text(x, y, value, { ...STYLE, fontSize: `${size}px` }).setOrigin(originX, 0)
  }

  private sprite(ref: SpriteRef, x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(x, y, ref.textureKey)
    applySpriteRef(sprite, ref)
    return sprite
  }

  private heading(y: number, value: string): number {
    this.text(4, y, value, 11, 0).setColor('#2b2620')
    return y + 18
  }

  private header(y: number): number {
    this.text(4, y, 'ARC Mage art gallery', 14, 0).setColor('#2b2620')
    this.text(4, y + 18, 'Wheel or arrow keys scroll, shift+wheel scrolls sideways.', 8, 0)

    const specs = Array.from({ length: 36 }, (_, i) =>
      monsterSpec(`timing:${i}`, BODIES[i % 8], WEAPONS[(i * 3) % 8], PASSIVES[(i * 5) % 8], SIZES[i % 3], (i * 47) % 360, i, 0.75 + (i % 5) * 0.2),
    )
    const t0 = performance.now()
    prewarm(this, specs)
    const first = performance.now() - t0
    const refs = specs.map((spec) => this.art.monster(this, spec))
    const t1 = performance.now()
    specs.forEach((spec) => this.art.monster(this, spec))
    const again = performance.now() - t1
    this.text(4, y + 30, `36 monsters generated in ${first.toFixed(1)} ms (${(first / 36).toFixed(2)} ms each), cached lookups ${again.toFixed(2)} ms`, 8, 0).setColor('#9c3b2e')

    this.memory = this.text(4, y + 42, '', 8, 0).setColor('#9c3b2e')
    const row = y + 58
    refs.forEach((ref, i) => this.sprite(ref, LEFT + (i % 12) * 90 + 40, row + 62 + Math.floor(i / 12) * 76))
    return row + 3 * 76 + 10
  }

  // Textures one segment needs: its 36 monsters, one tile theme, all fx and one boss.
  private memoryReport(): string {
    const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2)
    const monsters = textureBytes(this, 'scribble:monster:timing:')
    const fx = textureBytes(this, 'scribble:fx:')
    const boss = textureBytes(this, 'scribble:boss:rootTreant') + textureBytes(this, 'scribble:boss:weakPoint')
    const themes = THEMES.map((theme) => textureBytes(this, `scribble:tile:${theme}`) + textureBytes(this, `scribble:bg:${theme}`))
    const other = textureBytes(this, 'scribble:weapon:') + textureBytes(this, 'scribble:projectile:') + textureBytes(this, 'scribble:telegraph:')
    const total = monsters + fx + boss + other + Math.max(...themes)
    return `texture memory per segment: 36 monsters ${mb(monsters)} MB, theme ${themes.map(mb).join(' / ')} MB, fx ${mb(fx)} MB, boss ${mb(boss)} MB, weapons, shots and telegraphs ${mb(other)} MB, total ${mb(total)} MB`
  }

  private bodyWeaponGrid(top: number): number {
    let y = this.heading(top, 'Bodies x weapons (size, hue, weapon scale and passive vary per cell)')
    WEAPONS.forEach((weapon, c) => this.text(LEFT + c * CELL.w + CELL.w / 2, y, weapon, 8))
    y += 12
    BODIES.forEach((body, r) => {
      this.text(2, y + 36, body, 8, 0)
      WEAPONS.forEach((weapon, c) => {
        const n = r * 8 + c
        const spec = monsterSpec(`grid:${n}`, body, weapon, PASSIVES[(r + c) % 8], SIZES[(r + c * 2) % 3], (r * 40 + c * 25) % 360, n, 0.75 + (n % 5) * 0.2)
        this.sprite(this.art.monster(this, spec), LEFT + c * CELL.w + CELL.w / 2, y + 62)
      })
      y += CELL.h
    })
    return y + 12
  }

  private passiveRows(top: number): number {
    let y = this.heading(top, 'Passive marks (rows: large golem, medium imp, small beetle)')
    PASSIVES.forEach((passive, c) => this.text(LEFT + c * CELL.w + CELL.w / 2, y, passive, 8))
    y += 12
    const rows: [BodyKind, MonsterSpec['size']][] = [['golem', 'large'], ['imp', 'medium'], ['beetle', 'small']]
    rows.forEach(([body, size], r) => {
      PASSIVES.forEach((passive, c) => {
        const spec = monsterSpec(`passive:${r}:${c}`, body, 'claw', passive, size, 20 + c * 43, c)
        this.sprite(this.art.monster(this, spec), LEFT + c * CELL.w + CELL.w / 2, y + 62)
      })
      y += CELL.h
    })
    return y + 12
  }

  private faceRow(top: number): number {
    let y = this.heading(top, 'Faces (passive variant 0 to 15: eyes = variant % 4, mouth = variant / 4)')
    for (let v = 0; v < 16; v++) {
      const spec = monsterSpec(`face:${v}`, v < 8 ? 'slime' : 'imp', 'wand', 'tuned', 'medium', v * 22, v)
      this.sprite(this.art.monster(this, spec), LEFT + (v % 8) * CELL.w + CELL.w / 2, y + 48 + Math.floor(v / 8) * 62)
      this.text(LEFT + (v % 8) * CELL.w + CELL.w / 2, y + 50 + Math.floor(v / 8) * 62, `${v}`, 7)
    }
    y += 2 * 62
    return y + 12
  }

  private bossRow(top: number): number {
    let y = this.heading(top, 'Bosses (assembled at rest, then each part on its own)')
    const ground = y + 140
    ARCHETYPES.forEach((archetype, i) => {
      const x = LEFT + 60 + i * 260
      const ref = this.art.boss(this, bossSpec(archetype))
      this.sprite(ref, x, ground)
      const parts = Object.entries(ref.parts) as [string, PartRef][]
      for (const [, part] of parts) this.sprite(part, x + part.rest.x, ground + part.rest.y)
      this.text(x, ground + 4, `${archetype} ${ref.width}x${ref.height}`, 8)
      parts.forEach(([name, part], p) => {
        const px = x - 110 + p * 56
        this.sprite(part, px, ground + 78)
        this.text(px, ground + 80, name, 6)
      })
    })
    y = ground + 100
    return y + 12
  }

  private finalBossRow(top: number): number {
    const y = this.heading(top, 'Final boss (assembled, then the parts)')
    const ground = y + 170
    const ref = this.art.finalBoss(this, FINAL_BOSS)
    const x = LEFT + 130
    this.sprite(ref, x, ground)
    const parts = Object.entries(ref.parts) as [string, PartRef][]
    for (const [, part] of parts) this.sprite(part, x + part.rest.x, ground + part.rest.y)
    this.text(x, ground + 4, `finalBoss ${ref.width}x${ref.height}`, 8)
    parts.forEach(([name, part], p) => {
      const px = LEFT + 430 + p * 120
      this.sprite(part, px, ground)
      this.text(px, ground + 4, name, 7)
    })
    return ground + 24
  }

  private weaponRows(top: number): number {
    let y = this.heading(top, 'Player weapons, tier 1 on the first row and tier 2 on the second')
    PLAYER_WEAPONS.forEach((id, c) => this.text(LEFT + c * 100 + 50, y, id, 7))
    y += 10
    for (const tier of [1, 2] as const) {
      PLAYER_WEAPONS.forEach((id, c) => this.sprite(this.art.playerWeapon(this, id, tier), LEFT + c * 100 + 50, y + 56))
      y += 64
    }
    return y + 10
  }

  private smallThings(top: number): number {
    let y = this.heading(top, 'Projectiles (true size, then 3x), telegraphs and fx')
    PROJECTILES.forEach((kind, i) => {
      const ref = this.art.projectile(this, kind)
      const x = LEFT + i * 80 + 20
      this.sprite(ref, x, y + 14 + ref.height / 2).setOrigin(0.5, 0.5)
      this.sprite(ref, x + 40, y + 46).setDisplaySize(ref.width * 3, ref.height * 3)
      this.text(x, y + 56, kind, 7)
    })
    y += 70
    TELEGRAPHS.forEach(({ shape, w, h }, i) => {
      const key = this.art.telegraph(this, shape, w, h)
      const x = LEFT + i * 150
      this.add.image(x, y, key).setOrigin(0, 0).setDisplaySize(w, h)
      this.text(x + w / 2, y + 62, `${shape} ${w}x${h}`, 7)
    })
    y += 80
    FX.forEach((kind, i) => {
      const animKey = this.art.fx(this, kind)
      const x = LEFT + i * 100 + 30
      const play = (sprite: Phaser.GameObjects.Sprite) => {
        sprite.play(animKey)
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.time.delayedCall(350, () => play(sprite)))
      }
      const small = this.add.sprite(x, y + 24, '__DEFAULT').setScale(1 / TEXTURE_SCALE)
      play(small)
      const big = this.add.sprite(x + 40, y + 40, '__DEFAULT').setScale(1)
      play(big)
      this.text(x + 20, y + 76, kind, 7)
    })
    return y + 92
  }

  private themePanels(top: number): number {
    let y = this.heading(top, 'Tiles and parallax backgrounds (back layer to front layer)')
    THEMES.forEach((theme) => {
      const tiles = this.art.tiles(this, theme)
      this.text(4, y, theme, 9, 0)
      y += 12
      const left = 4
      tiles.background.forEach((key, i) => {
        const layer = this.add.tileSprite(left, y, 480, 360, key).setOrigin(0, 0).setTileScale(1 / TEXTURE_SCALE)
        this.parallax.push({ sprite: layer, speed: 20 * (i + 1) })
      })
      for (let i = 0; i < 20; i++) this.add.image(left + i * 24, y + 360 - 24, tiles.ground).setOrigin(0, 0).setDisplaySize(24, 24)
      for (let i = 0; i < 4; i++) this.add.image(left + 120 + i * 24, y + 360 - 24 - 56, tiles.platform).setOrigin(0, 0).setDisplaySize(24, 8)
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 3; j++) this.add.image(left + 20 * 24 + 4 - 48 + i * 24, y + 360 - 24 - 24 * (j + 1), tiles.wall).setOrigin(0, 0).setDisplaySize(24, 24)
      }
      const spec = monsterSpec(`theme:${theme}`, 'imp', 'wand', 'blink', 'medium', 40, 3)
      this.sprite(this.art.monster(this, spec), left + 220, y + 360 - 24)
      // The same tiles repeated, to check the seams.
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 10; c++) this.add.image(520 + c * 24, y + 40 + r * 24, tiles.ground).setOrigin(0, 0).setDisplaySize(24, 24)
        for (let c = 0; c < 10; c++) this.add.image(520 + c * 24, y + 160 + r * 8, tiles.platform).setOrigin(0, 0).setDisplaySize(24, 8)
        for (let c = 0; c < 10; c++) this.add.image(520 + c * 24, y + 200 + r * 24, tiles.wall).setOrigin(0, 0).setDisplaySize(24, 24)
      }
      y += 360 + 20
    })
    return y
  }
}
