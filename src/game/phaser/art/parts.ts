import type { PartRef, SpriteRef } from '../../contracts/art'

export type { PartRef }

export type BossArt = SpriteRef & { parts: Record<string, PartRef> }
