import { ARC } from '@nfdi4plants/arctrl'
import { beforeAll, describe, expect, it } from 'vitest'
import { buildProvenanceIndex } from '../../../src/arc/provenance/buildIndex'
import type { RunPlan } from '../../../src/game/contracts/run'
import { planRun } from '../../../src/game/model/run'
import { appendLevelUp, fitLine, historyRow, sourceText, type LevelUpRecord } from '../../../src/game/phaser/scenes/levelHistory'
import { RunDirector } from '../../../src/game/phaser/scenes/RunDirector'
import { crateJson } from '../../helpers/sampleCrate'

let plan: RunPlan

beforeAll(() => {
  const found = planRun(buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson)), 'Talinum', 'history')
  if (!found) throw new Error('No plan')
  plan = found
})

function director(): RunDirector {
  return new RunDirector(plan, { emit: () => {}, enter: () => {} })
}

function levelUp(d: RunDirector, choose: (offer: ReturnType<RunDirector['rollOffer']>) => string | null) {
  d.creditXp(1000)
  while (d.pendingLevelUps > 0) d.chooseCard(choose(d.rollOffer()))
}

describe('level history', () => {
  it('records each choice in level order with the cards left on the table', () => {
    const d = director()
    d.start()
    const picks: string[] = []
    d.creditXp(20)
    expect(d.pendingLevelUps).toBe(1)
    const offer = d.rollOffer()
    d.chooseCard(offer[1].id)
    picks.push(offer[1].id)
    d.creditXp(30)
    const second = d.rollOffer()
    d.chooseCard(second[0].id)

    const [first, next] = d.levelHistory
    expect(d.levelHistory.map((entry) => entry.level)).toEqual([2, 3])
    expect(first.cardId).toBe(picks[0])
    expect(first.cardName).toBe(offer[1].name)
    expect(first.rarity).toBe(offer[1].rarity)
    expect(first.offered.map((card) => card.id)).toEqual(offer.filter((card) => card.id !== offer[1].id).map((card) => card.id))
    expect(next.cardId).toBe(second[0].id)
  })

  it('numbers several levels gained at once', () => {
    const d = director()
    d.start()
    levelUp(d, (offer) => offer[0].id)
    const levels = d.levelHistory.map((entry) => entry.level)
    expect(levels.length).toBeGreaterThan(1)
    expect(levels).toEqual(levels.map((_, i) => i + 2))
  })

  it('records a skipped choice', () => {
    const d = director()
    d.start()
    d.creditXp(20)
    d.chooseCard(null)
    expect(d.levelHistory[0]).toMatchObject({ level: 2, cardId: null, cardName: null, rarity: null, offered: [] })
    expect(historyRow(d.levelHistory[0]).title).toBe('Lv 2 · no card on offer')
  })

  it('names the stretch where the XP came from', () => {
    const d = director()
    d.start()
    d.creditXp(20)
    d.chooseCard(d.rollOffer()[0].id)
    const segment = plan.segments[0]
    expect(d.levelHistory[0].source).toBe(`earned in ${segment.datasetId.replace(/\/+$/, '')} · ${segment.processName}`)
  })

  it('names the boss while a boss fight runs', () => {
    const d = director()
    d.start()
    d.completeStretch()
    d.creditXp(20)
    d.chooseCard(d.rollOffer()[0].id)
    expect(d.levelHistory[0].source).toContain(`boss ${d.bossSpec(0).label}`)
  })

  it('starts empty for a new run', () => {
    const d = director()
    d.start()
    levelUp(d, (offer) => offer[0].id)
    expect(d.levelHistory.length).toBeGreaterThan(0)
    const fresh = director()
    fresh.start()
    expect(fresh.levelHistory).toEqual([])
  })
})

describe('level history helpers', () => {
  const record = (level: number): LevelUpRecord => ({ level, cardId: 'a', cardName: 'Sharpened', rarity: 'common', offered: [], source: 'x' })

  it('keeps entries in level order', () => {
    const list = appendLevelUp(appendLevelUp([], record(4)), record(2))
    expect(list.map((entry) => entry.level)).toEqual([2, 4])
  })

  it('words the source for each stage kind', () => {
    expect(sourceText({ kind: 'finalBoss' }, plan, '')).toBe('earned against the final boss')
    expect(sourceText({ kind: 'victory' }, plan, '')).toBe('earned at the end of the run')
    expect(sourceText({ kind: 'stretch', index: 0 }, plan, '')).toMatch(/^earned in .+ · /)
    expect(sourceText({ kind: 'boss', index: 0 }, plan, 'Node')).toMatch(/^earned against boss Node after /)
  })

  it('words a row with the offered alternatives', () => {
    const row = historyRow({ ...record(4), offered: [{ id: 'w', name: 'Wand' }, { id: 'k', name: 'Keen Eye' }] })
    expect(row.title).toBe('Lv 4 · Sharpened (common)')
    expect(row.also).toBe('also offered: Wand, Keen Eye')
    expect(historyRow(record(4)).also).toBeNull()
  })

  it('shortens long lines with an ellipsis', () => {
    expect(fitLine('short', 10)).toBe('short')
    expect(fitLine('a long line of text', 8).length).toBeLessThanOrEqual(8)
    expect(fitLine('a long line of text', 8).endsWith('…')).toBe(true)
  })
})
