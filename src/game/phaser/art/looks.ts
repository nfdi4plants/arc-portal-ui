import { MATERIAL } from './palette'
import type { Swatch } from './palette'
import type { Look } from './pen'

// Ready-made fills. Light parts are hatched once, dark parts are hatched across.

export const hatched = (sw: Swatch): Look => ({ tint: sw.light, hatch: sw.mid })
export const shaded = (sw: Swatch): Look => ({ tint: sw.mid, hatch: sw.dark, fill: 'cross-hatch', gap: 2.8 })
export const detail = (sw: Swatch): Look => ({ tint: sw.accent, hatch: sw.accentDark })
export const detailDark = (sw: Swatch): Look => ({ tint: sw.accent, hatch: sw.accentDark, fill: 'cross-hatch', gap: 2.8 })

export const wood: Look = { tint: MATERIAL.wood.tint, hatch: MATERIAL.wood.hatch }
export const metal: Look = { tint: MATERIAL.metal.tint, hatch: MATERIAL.metal.hatch }
export const darkMetal: Look = { tint: MATERIAL.metal.hatch, hatch: MATERIAL.metal.dark, fill: 'cross-hatch', gap: 2.8 }
export const bone: Look = { tint: MATERIAL.bone.tint, hatch: MATERIAL.bone.hatch }
export const glass: Look = { tint: MATERIAL.glass.tint, hatch: MATERIAL.glass.hatch, gap: 3.2 }
export const gold: Look = { tint: MATERIAL.gold.tint, hatch: MATERIAL.gold.hatch }
export const stone: Look = { tint: MATERIAL.stone.tint, hatch: MATERIAL.stone.hatch }
export const fire: Look = { tint: MATERIAL.fire.tint, hatch: MATERIAL.fire.hatch }
export const paper: Look = { tint: '#fffdf6' }
export const white: Look = { tint: MATERIAL.white }

// A thin stroke for details that sit inside a larger shape.
export const thin: Look = { weight: 0.8 }
