// Deterministic randomness. Monsters, paths and levels all derive from string seeds, so the
// same ARC and seed always produce the same run.

// FNV-1a, 32 bit.
export function hashString(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export interface Rng {
  // In [0, 1).
  next(): number
  int(min: number, maxInclusive: number): number
  pick<T>(items: readonly T[]): T
  chance(p: number): boolean
  // An independent stream. Forking with the same label from the same seed gives the same stream,
  // and drawing from a fork never changes the parent's sequence.
  fork(label: string): Rng
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createRng(seed: string | number): Rng {
  const seedText = String(seed)
  const next = mulberry32(hashString(seedText))
  return {
    next,
    int(min, maxInclusive) {
      return min + Math.floor(next() * (maxInclusive - min + 1))
    },
    pick(items) {
      if (items.length === 0) throw new Error('Rng.pick needs at least one item')
      return items[Math.floor(next() * items.length)]
    },
    chance(p) {
      return next() < p
    },
    fork(label) {
      return createRng(`${seedText}/${label}`)
    },
  }
}
