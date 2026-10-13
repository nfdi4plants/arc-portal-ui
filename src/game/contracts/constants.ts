// Shared world units. The camera shows WORLD_VIEW_HEIGHT units vertically at any box size.
export const WORLD_VIEW_HEIGHT = 360
export const WORLD_MIN_VIEW_WIDTH = 480
// Wider boxes are letterboxed beyond 21:9.
export const WORLD_MAX_ASPECT = 21 / 9
export const TILE = 24
export const PLAYER_HEIGHT = 48

// Arcade physics runs at a fixed 120 Hz so the controls feel the same on 60 Hz and 144 Hz screens.
export const PHYSICS_FPS = 120
export const STEP_MS = 1000 / PHYSICS_FPS

export const SCENE = {
  boot: 'Boot',
  stretch: 'Stretch',
  boss: 'Boss',
  finalBoss: 'FinalBoss',
  hud: 'Hud',
  levelUp: 'LevelUp',
  death: 'Death',
  victory: 'Victory',
  testRoom: 'TestRoom',
  mobSandbox: 'MobSandbox',
  bossSandbox: 'BossSandbox',
  artGallery: 'ArtGallery',
  combatSandbox: 'CombatSandbox',
} as const

export const DEPTH = {
  background: 0,
  tiles: 10,
  pickups: 20,
  enemies: 30,
  player: 40,
  projectiles: 50,
  fx: 60,
  telegraphs: 70,
  hud: 100,
} as const

// Taken from the mage sprite.
export const PALETTE = {
  blue: 0x4baed6,
  teal: 0x22c3a6,
  cream: 0xf5e6d3,
  navy: 0x253447,
  yellow: 0xf5be00,
  outline: 0x191919,
} as const

export const MAGE_TEXTURE = 'arc-mage'
