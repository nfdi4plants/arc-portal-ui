import { ARC } from '@nfdi4plants/arctrl'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { buildProvenanceIndex } from '../../src/arc/provenance/buildIndex'
import type { Annotation, ProvenanceIndex } from '../../src/arc/provenance/types'
import { ArcGameDashlet } from '../../src/components/ArcDashboard/Game'
import type { GameHandle } from '../../src/game/contracts/events'
import type { RunPlan } from '../../src/game/contracts/run'
import type * as InputModule from '../../src/game/model/input'
import { DEFAULT_BINDINGS, findConflicts, loadBindings, saveBindings } from '../../src/game/model/input'
import { planRun } from '../../src/game/model/run'
import { createGame } from '../../src/game/phaser/createGame'
import { renderWithTheme } from '../../src/test/helpers'
import { crateJson } from '../helpers/sampleCrate'

vi.mock('../../src/game/phaser/createGame', () => ({ createGame: vi.fn() }))
vi.mock('../../src/game/model/run', () => ({ planRun: vi.fn() }))
vi.mock('../../src/game/model/input', async (importOriginal) => ({
  ...(await importOriginal<typeof InputModule>()),
  loadBindings: vi.fn(),
  saveBindings: vi.fn(),
  findConflicts: vi.fn(),
  bindingLabel: (binding: { device: string; code?: string; button?: number }) =>
    binding.device === 'key' ? binding.code : `Mouse ${binding.button}`,
}))

const annotation = (name: string): Annotation => ({ name, value: '1', unit: null, accession: null, category: 'parameter' })

const plan: RunPlan = {
  seed: 'plan-seed',
  arcTitle: 'Talinum',
  nodes: [
    { id: 'DB_097', kind: 'source', annotations: [] },
    { id: 'DB_097_extract', kind: 'sample', annotations: [] },
    { id: 'DB_097_run.raw', kind: 'data', annotations: [] },
  ],
  segments: [
    {
      index: 0,
      fromNodeId: 'DB_097',
      toNodeId: 'DB_097_extract',
      processKey: 'studies/s/Extraction',
      processName: 'Extraction',
      datasetId: 'studies/s',
      datasetKind: 'study',
      annotations: [annotation('a'), annotation('b'), annotation('c')],
      quality: 3 / 8,
      telegraphMs: 388,
    },
    {
      index: 1,
      fromNodeId: 'DB_097_extract',
      toNodeId: 'DB_097_run.raw',
      processKey: 'assays/a/Measurement',
      processName: 'Measurement',
      datasetId: 'assays/a',
      datasetKind: 'assay',
      annotations: [annotation('d')],
      quality: 1 / 8,
      telegraphMs: 183,
    },
  ],
}

let index: ProvenanceIndex
let handle: GameHandle
let visibilityCallbacks: IntersectionObserverCallback[]

beforeAll(() => {
  index = buildProvenanceIndex(ARC.fromROCrateJsonString(crateJson))
})

function stubPointer(fine: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: fine && query === '(any-pointer: fine)',
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }))
}

// jsdom has no IntersectionObserver. The stub lets a test report that the dashlet scrolled out of view.
function scrollIntoView(visible: boolean) {
  act(() => visibilityCallbacks.at(-1)?.([{ isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver))
}

beforeEach(() => {
  stubPointer(true)
  visibilityCallbacks = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        visibilityCallbacks.push(callback)
      }
      observe() {}
      disconnect() {}
    },
  )
  handle = { send: vi.fn(), on: vi.fn(() => () => {}), resize: vi.fn(), focus: vi.fn(), destroy: vi.fn() }
  vi.mocked(createGame).mockReturnValue(handle)
  vi.mocked(planRun).mockReturnValue(plan)
  vi.mocked(loadBindings).mockReturnValue(DEFAULT_BINDINGS)
  vi.mocked(findConflicts).mockReturnValue([])
})

it('shows the planned path on the start screen', async () => {
  renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)

  expect(await screen.findByRole('button', { name: 'Start run' })).toBeInTheDocument()
  expect(planRun).toHaveBeenCalledWith(index, 'Talinum', expect.stringMatching(/^[0-9a-z]+$/))
  const facts = screen.getByText('Steps').closest('dl')
  expect(facts).toHaveTextContent('DB_097 → DB_097_run.raw')
  expect(facts).toHaveTextContent('Steps2Annotations4Seedplan-seed')
  const steps = within(screen.getByRole('region', { name: 'Annotations per step' })).getAllByRole('listitem')
  expect(steps.map((step) => step.textContent)).toEqual(['Extraction3', 'Measurement1'])
})

it('creates the game and starts the run when Start run is pressed', async () => {
  const user = userEvent.setup()
  renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)

  await user.click(await screen.findByRole('button', { name: 'Start run' }))

  await user.click(await screen.findByRole('button', { name: 'Click to play' }))
  expect(createGame).toHaveBeenCalledTimes(1)
  expect(createGame).toHaveBeenCalledWith(expect.any(HTMLElement), { bindings: DEFAULT_BINDINGS })
  expect(handle.send).toHaveBeenCalledWith({ type: 'start', plan })
  expect(handle.focus).toHaveBeenCalled()
})

it('pauses the game while the canvas has no focus or the dashlet is scrolled out of view', async () => {
  const user = userEvent.setup()
  renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)
  await user.click(await screen.findByRole('button', { name: 'Start run' }))
  await screen.findByRole('button', { name: 'Click to play' })
  const lastPause = () => vi.mocked(handle.send).mock.calls.filter(([command]) => command.type === 'pause').at(-1)?.[0]
  expect(lastPause()).toEqual({ type: 'pause', paused: true })

  const game = screen.getByRole('group', { name: 'ARC Mage game' })
  act(() => void game.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
  expect(lastPause()).toEqual({ type: 'pause', paused: false })
  expect(screen.queryByRole('button', { name: 'Click to play' })).not.toBeInTheDocument()

  scrollIntoView(false)
  expect(lastPause()).toEqual({ type: 'pause', paused: true })
  scrollIntoView(true)
  expect(lastPause()).toEqual({ type: 'pause', paused: false })

  act(() => void game.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  expect(lastPause()).toEqual({ type: 'pause', paused: true })
  expect(screen.getByRole('button', { name: 'Click to play' })).toBeInTheDocument()
})

it('rebinds an action to the next key and warns about the conflict', async () => {
  const user = userEvent.setup()
  vi.mocked(findConflicts).mockImplementation((bindings) => {
    const [first] = bindings.left
    return first?.device === 'key' && first.code === 'KeyS'
      ? [{ binding: first, actions: ['left', 'down'] }]
      : []
  })
  renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)
  await user.click(await screen.findByRole('button', { name: 'Settings' }))

  await user.click(screen.getByRole('button', { name: 'Move right binding 1: KeyD' }))
  await user.keyboard('{Escape}')
  expect(saveBindings).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Move left binding 1: KeyA' }))
  await user.keyboard('s')

  expect(saveBindings).toHaveBeenCalledWith({ ...DEFAULT_BINDINGS, left: [{ device: 'key', code: 'KeyS' }] })
  expect(await screen.findByRole('button', { name: 'Move left binding 1: KeyS' })).toBeInTheDocument()
  const rows = screen.getAllByRole('listitem')
  expect(rows.find((row) => within(row).queryByText('Move left'))).toHaveTextContent('is also bound to Down')
  expect(rows.find((row) => within(row).queryByText('Down'))).toHaveTextContent('is also bound to Move left')
})

it('asks for a keyboard and a mouse on a touch-only device', async () => {
  stubPointer(false)
  renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)

  expect(await screen.findByText('The ARC Mage needs a keyboard and a mouse.')).toBeInTheDocument()
  expect(screen.getByText('Extraction')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument()
})

it('explains that an ARC without provenance has no path', async () => {
  vi.mocked(planRun).mockReturnValue(null)
  renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)

  expect(
    await screen.findByText('This ARC has no provenance yet. Annotate a study or assay table to open the path for the ARC Mage.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument()
})

it('destroys the game when the dashlet unmounts', async () => {
  const user = userEvent.setup()
  const { unmount } = renderWithTheme(<ArcGameDashlet index={index} arcTitle="Talinum" />)
  await user.click(await screen.findByRole('button', { name: 'Start run' }))
  await screen.findByRole('button', { name: 'Click to play' })
  expect(handle.destroy).not.toHaveBeenCalled()

  unmount()

  expect(handle.destroy).toHaveBeenCalledTimes(1)
})
