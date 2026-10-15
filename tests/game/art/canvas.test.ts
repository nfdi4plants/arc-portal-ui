import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { ART_CONTEXT, artContext } from '../../../src/game/phaser/art/canvas'

const GAME_SRC = join(__dirname, '../../../src/game')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('artContext', () => {
  it('asks for a canvas kept in main memory, whose pixels survive a GPU reset', () => {
    const context = {} as CanvasRenderingContext2D
    const getContext = vi.fn(() => context)
    const canvas = { getContext } as unknown as HTMLCanvasElement
    expect(artContext(canvas)).toBe(context)
    expect(getContext).toHaveBeenCalledWith('2d', ART_CONTEXT)
    expect(ART_CONTEXT.willReadFrequently).toBe(true)
  })

  // Phaser uploads a texture's source canvas again after a WebGL context loss. A GPU-backed
  // canvas comes back blank from the same reset, and so do the mobs, tiles and effects drawn on it.
  it('leaves no GPU-backed 2D canvas in the game', () => {
    const offenders: string[] = []
    for (const file of sourceFiles(GAME_SRC)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (line.includes("getContext('2d'") && !line.includes('willReadFrequently: true') && !line.includes('ART_CONTEXT')) offenders.push(`${file}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
